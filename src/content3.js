// =====================================================================
//  MIAOU EMPIRE — Contenu v3 : ères infinies, artefacts, cosmétiques
//  (auras, titres, cadres, costumes), alchimie, transmutation, Tour des
//  Défis, attaques uniques des chatons, récompenses de recharge cumulée.
// =====================================================================

// ---------------------------------------------------------------- ÈRES (les maps se renouvellent à l'infini)
export const ERA_NAMES = ['Normal', 'Crépuscule', 'Cauchemar', 'Infernal'];
const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
export function eraOf(ch, nBiomes) {
  const e = Math.floor((ch - 1) / nBiomes);
  const v = e % 4;
  const cycle = Math.floor(e / 4) + 1;
  return { e, variant: v, name: ERA_NAMES[v] + (cycle > 1 ? (ROMAN[cycle] || ' ' + cycle) : ''), lootMult: 1 + e * 0.35 };
}
// essences d'ère : ne tombent qu'à partir de l'ère correspondante
export const ERA_DROPS = [null, ['duskEssence', 0.002], ['nightmareEssence', 0.0015], ['infernalEssence', 0.001]];

// ---------------------------------------------------------------- ARTEFACTS (niveaux infinis + étoiles)
// per = bonus par niveau ; stat : atk/hp en %, sinon statistique secondaire ; kitDmg = dégâts des chatons %
const A = (id, name, r, stat, per, color, shape) => ({ id, name, r, stat, per, color, shape });
export const ARTIFACTS = [
  A('pawCharm', 'Patte porte-bonheur', 4, 'luck', 4, '#62d86b', 'badge'),
  A('fishBone', 'Arête d\'or', 4, 'gold', 3, '#ffd54f', 'fang'),
  A('yarnOrb', 'Pelote éternelle', 4, 'atk', 2, '#ff5ca8', 'orb'),
  A('milkGrail', 'Bol de lait sacré', 4, 'hp', 2, '#ffffff', 'pile'),
  A('catnip', 'Herbe à chat royale', 4, 'atkSpd', 0.6, '#5fd068', 'wing'),
  A('sphinxEye', 'Œil du Sphinx', 5, 'crit', 0.25, '#48f3ff', 'orb'),
  A('moonBell', 'Grelot lunaire', 5, 'dodge', 0.2, '#c9cbd8', 'crystal'),
  A('tigerTooth', 'Dent de tigre', 5, 'critDmg', 2, '#ffb52e', 'fang'),
  A('heartBox', 'Carton-cœur', 5, 'hp', 3.5, '#ff4d5e', 'badge'),
  A('ninjaStar', 'Étoile ninja', 5, 'combo', 0.25, '#b968ff', 'star'),
  A('bastetAnkh', 'Ankh de Bastet', 6, 'atk', 4, '#ffd54f', 'rune'),
  A('phoenixFeather', 'Plume de phénix', 6, 'lifesteal', 0.15, '#ff7a1a', 'wing'),
  A('thunderClaw', 'Griffe-Tonnerre', 6, 'skillDmg', 3, '#ffe14d', 'fang'),
  A('crownShard', 'Éclat de couronne', 6, 'bossDmg', 3, '#ff7ae0', 'crystal'),
  A('kittenLantern', 'Lanterne des chatons', 6, 'kitDmg', 3, '#fff2a0', 'orb'),
  A('starMap', 'Carte des étoiles', 7, 'atk', 6, '#7fe9ff', 'cloth'),
  A('nineLivesBook', 'Grimoire des 9 vies', 7, 'hp', 7, '#c77dff', 'rune'),
  A('hourglass', 'Sablier du temps', 7, 'gold', 6, '#48f3ff', 'chip'),
  A('originStone', 'Pierre des Origines', 8, 'atk', 10, '#fff27a', 'star'),
  A('cosmicEye', 'Œil cosmique', 8, 'critDmg', 6, '#ff7ae0', 'tear'),
];
export const ARTIFACT_BY_ID = Object.fromEntries(ARTIFACTS.map((a) => [a.id, a]));
export const ARTIFACT_MAX_STARS = 10;
export function artifactFragsNeed(stars) { return stars < 0 ? 10 : (stars + 1) * 10; } // déblocage puis étoiles
export function artifactLevelCost(a, lvl) { return { dust: Math.ceil(6 * Math.pow(lvl, 1.35) * (1 + (a.r - 4) * 0.35)), gold: Math.round(250 * Math.pow(1.065, lvl) * (1 + (a.r - 4) * 0.5)) }; }
export function artifactBonus(a, lvl, stars) { return a.per * lvl * (1 + 0.25 * stars); }
export function artifactSlots(vip) { return vip >= 11 ? 6 : vip >= 6 ? 5 : 4; }
// coffre d'artefacts (gemmes) : rareté de l'artefact dont on reçoit des fragments
export const ARTIFACT_CHEST = { cost1: 120, cost10: 1080, odds: [0, 0, 0, 0, 55, 28, 12.2, 4, 0.8] };

// ---------------------------------------------------------------- COSMÉTIQUES
// Chaque cosmétique possédé donne un petit bonus permanent : la collection compte !
export const AURAS = [
  { id: 'sparkle', name: 'Paillettes', r: 2, colors: ['#ffffff', '#fff27a'], shape: 'star', motion: 'rise', atk: 1 },
  { id: 'petals', name: 'Pétales de cerisier', r: 3, colors: ['#ffb3d1', '#ffffff'], shape: 'debris', motion: 'fall', atk: 2 },
  { id: 'bubbles', name: 'Bulles', r: 3, colors: ['#bff4ff', '#7fe9ff'], shape: 'bubble', motion: 'rise', atk: 2 },
  { id: 'hearts', name: 'Cœurs', r: 4, colors: ['#ff5ca8', '#ff9fd8'], shape: 'heart', motion: 'rise', atk: 3 },
  { id: 'flames', name: 'Flammes', r: 4, colors: ['#ff7a1a', '#ffd23f'], shape: 'glow', motion: 'fire', atk: 3 },
  { id: 'frost', name: 'Givre', r: 4, colors: ['#bff4ff', '#ffffff'], shape: 'star', motion: 'orbit', atk: 3 },
  { id: 'thunder', name: 'Électrique', r: 5, colors: ['#ffe14d', '#7fe9ff'], shape: 'spark', motion: 'burst', atk: 4 },
  { id: 'shadow', name: 'Ombre', r: 5, colors: ['#2a1a40', '#8a3cff'], shape: 'smoke', motion: 'rise', atk: 4 },
  { id: 'money', name: 'Pluie d\'or', r: 5, colors: ['#ffd54f', '#fff6b0'], shape: 'coin', motion: 'fall', atk: 4 },
  { id: 'notes', name: 'Mélodie', r: 5, colors: ['#ff7ae0', '#48f3ff', '#ffe14d'], shape: 'note', motion: 'orbit', atk: 4 },
  { id: 'rainbow', name: 'Arc-en-ciel', r: 6, colors: ['#ff4d5e', '#ffd23f', '#62d86b', '#48f3ff', '#b968ff'], shape: 'glow', motion: 'ring', atk: 6 },
  { id: 'galaxy', name: 'Galaxie', r: 7, colors: ['#c77dff', '#ff7ae0', '#ffffff'], shape: 'star', motion: 'spiral', atk: 8 },
  { id: 'divine', name: 'Lumière divine', r: 7, colors: ['#fff2a0', '#ffffff'], shape: 'star', motion: 'pillar', atk: 8 },
  { id: 'banner', name: 'Étendard de guilde', r: 6, colors: ['#ffcc33', '#ff4d5e', '#4aa9ff'], shape: 'star', motion: 'ring', atk: 5 },
  { id: 'lantern', name: 'Lanternes du Festival', r: 7, colors: ['#ff4d5e', '#ffd23f', '#fff27a'], shape: 'glow', motion: 'rise', atk: 6 },
  { id: 'origin', name: 'Aura des Origines', r: 8, colors: ['#ff4d5e', '#ffd23f', '#62d86b', '#48f3ff', '#ff7ae0'], shape: 'star', motion: 'spiral', atk: 12 },
];
export const AURA_BY_ID = Object.fromEntries(AURAS.map((a) => [a.id, a]));
export const TITLES = [
  { id: 'kitten', name: 'Chaton', r: 0, hp: 0, src: 'Par défaut' },
  { id: 'claw', name: 'Griffe d\'acier', r: 2, hp: 1, src: 'Étape 3-1' },
  { id: 'ratHunter', name: 'Chasseur de rats', r: 2, hp: 1, src: '1 000 ennemis vaincus' },
  { id: 'climber', name: 'Grimpeur', r: 3, hp: 2, src: 'Tour des Défis étage 25' },
  { id: 'partyKing', name: 'Roi de la Fête', r: 6, hp: 5, src: 'Dernier palier du Festival' },
  { id: 'towerMaster', name: 'Maître de la Tour', r: 7, hp: 6, src: 'N°1 du classement de la Tour' },
  { id: 'bossSlayer', name: 'Fléau des Boss', r: 5, hp: 4, src: 'Top 3 du Boss mondial' },
  { id: 'artisan', name: 'Maître artisan', r: 3, hp: 2, src: 'Artisan niveau 20' },
  { id: 'forgemage', name: 'Forgemage', r: 4, hp: 3, src: 'Un objet à +10' },
  { id: 'tamer', name: 'Dompteur de chatons', r: 4, hp: 3, src: '25 chatons différents' },
  { id: 'baron', name: 'Baron du marché', r: 4, hp: 3, src: '100 ventes au marché' },
  { id: 'gutterKing', name: 'Roi des Gouttières', r: 5, hp: 4, src: 'Guerre : 1re place' },
  { id: 'conqueror', name: 'Conquérant de la Tour', r: 5, hp: 4, src: 'Tour des Défis étage 100' },
  { id: 'arenaLegend', name: 'Légende de l\'Arène', r: 6, hp: 5, src: 'Arène : top 3' },
  { id: 'nightmare', name: 'Seigneur du Cauchemar', r: 6, hp: 5, src: 'Atteindre l\'ère Cauchemar' },
  { id: 'infernal', name: 'Flamme infernale', r: 7, hp: 6, src: 'Atteindre l\'ère Infernal' },
  { id: 'unstoppable', name: 'Inarrêtable', r: 7, hp: 6, src: 'Tour des Défis étage 250' },
  { id: 'patron', name: 'Mécène royal', r: 7, hp: 6, src: 'Récompense de fidélité' },
  { id: 'emperor', name: 'Empereur des Chats', r: 8, hp: 8, src: 'VIP 15' },
  { id: 'catGod', name: 'Divinité Féline', r: 8, hp: 12, src: 'VIP 20' },
  { id: 'bastet', name: 'Élu de Bastet', r: 7, hp: 6, src: 'Autel de Bastet niveau 50' },
  { id: 'primordial', name: 'Primordial', r: 8, hp: 8, src: 'Posséder un chaton Primordial' },
];
export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t]));
export const FRAMES = [
  { id: 'basic', name: 'Classique', r: 0, luck: 0, src: 'Par défaut' },
  { id: 'wood', name: 'Bois', r: 1, luck: 2, src: 'Tour étage 10' },
  { id: 'silver', name: 'Argent', r: 2, luck: 3, src: 'Arène : division Argent' },
  { id: 'gold', name: 'Or', r: 4, luck: 4, src: 'Boutique (gemmes)' },
  { id: 'ruby', name: 'Rubis', r: 5, luck: 5, src: 'Tour étage 75' },
  { id: 'neon', name: 'Néon', r: 5, luck: 5, src: 'Boutique (gemmes)' },
  { id: 'flames', name: 'Flammes', r: 6, luck: 7, src: 'Récompense de fidélité' },
  { id: 'rainbow', name: 'Arc-en-ciel', r: 7, luck: 8, src: 'Tour étage 150' },
  { id: 'cosmic', name: 'Cosmique', r: 8, luck: 10, src: 'Récompense de fidélité' },
  { id: 'blazon', name: 'Blason', r: 6, luck: 6, src: 'Boutique de guilde' },
  { id: 'festival', name: 'Festival', r: 7, luck: 7, src: 'Événement de la semaine' },
];
export const FRAME_BY_ID = Object.fromEntries(FRAMES.map((f) => [f.id, f]));
// Boutique de style (gemmes)
export const STYLE_SHOP = [
  { kind: 'aura', id: 'sparkle', gems: 300 }, { kind: 'aura', id: 'petals', gems: 600 }, { kind: 'aura', id: 'bubbles', gems: 600 },
  { kind: 'aura', id: 'hearts', gems: 1200 }, { kind: 'aura', id: 'flames', gems: 1500 }, { kind: 'aura', id: 'notes', gems: 2500 },
  { kind: 'aura', id: 'rainbow', gems: 6000 }, { kind: 'frame', id: 'gold', gems: 800 }, { kind: 'frame', id: 'neon', gems: 1500 },
  { kind: 'costume', id: 'chef', gems: 1500 }, { kind: 'costume', id: 'cowboy', gems: 1800 }, { kind: 'costume', id: 'viking', gems: 2500 }, { kind: 'costume', id: 'witch', gems: 3000 },
];
// Costumes supplémentaires (ajoutés aux 11 de content.js)
export const COSTUMES3 = [
  { id: 'chef', name: 'Grand Chef', r: 3, atk: 5, hp: 5, src: 'Boutique de style', look: { fur: 'blanc', eye: 'bleu' }, gear: { hat: { base: 'chef', r: 4 }, weapon: { base: 'ladle', r: 4 }, face: { base: 'stache', r: 2 } } },
  { id: 'cowboy', name: 'Shérif Moustache', r: 4, atk: 8, hp: 6, src: 'Boutique de style', look: { fur: 'fauve', pattern: 'tabby', eye: 'ambre' }, gear: { hat: { base: 'cowboy', r: 4 }, weapon: { base: 'bow', r: 4 }, boots: { base: 'boots', r: 4 } } },
  { id: 'viking', name: 'Jarl Griffu', r: 4, atk: 10, hp: 10, src: 'Boutique de style', look: { fur: 'roux', pattern: 'tiger', eye: 'bleu' }, gear: { hat: { base: 'viking', r: 5 }, weapon: { base: 'axe', r: 5 }, armor: { base: 'plate', r: 4 } } },
  { id: 'witch', name: 'Sorcière Minuit', r: 5, atk: 14, hp: 8, src: 'Boutique de style', look: { fur: 'noir', eye: 'vert', eyeStyle: 'sparkle' }, gear: { hat: { base: 'wizard', r: 6 }, weapon: { base: 'staff', r: 6 }, armor: { base: 'robe', r: 6 }, wings: { base: 'bat', r: 5 } } },
  { id: 'samurai', name: 'Samouraï Écarlate', r: 5, atk: 16, hp: 10, src: 'Fidélité 50 €', look: { fur: 'blanc', pattern: 'calico', eye: 'or', eyeStyle: 'fierce' }, gear: { hat: { base: 'bandana', r: 5 }, weapon: { base: 'katana', r: 6 }, armor: { base: 'kimono', r: 5 } } },
  { id: 'astronaut', name: 'Astro-Matou', r: 6, atk: 20, hp: 20, src: 'Tour des Défis étage 75', look: { fur: 'argent', eye: 'glace' }, gear: { hat: { base: 'helmet', r: 7 }, face: { base: 'visor', r: 7 }, wings: { base: 'jetpack', r: 7 } } },
  { id: 'angel', name: 'Archange Ronron', r: 6, atk: 25, hp: 30, src: 'Fidélité 250 €', look: { fur: 'blanc', eye: 'or', eyeStyle: 'sparkle' }, gear: { hat: { base: 'flowers', r: 6 }, armor: { base: 'robe', r: 7 }, wings: { base: 'angel', r: 7 }, weapon: { base: 'wand', r: 7 } } },
  { id: 'demon', name: 'Démon des Gouttières', r: 7, atk: 35, hp: 25, src: 'Tour des Défis étage 200', look: { fur: 'ombre', eye: 'rouge', eyeStyle: 'fierce', ears: 'lynx' }, gear: { wings: { base: 'bat', r: 7 }, weapon: { base: 'scythe', r: 7 }, cape: { base: 'skull', r: 6 } } },
  { id: 'king', name: 'Roi Soleil', r: 7, atk: 45, hp: 45, src: 'Fidélité 1 000 €', look: { fur: 'dore', eye: 'ambre', ears: 'big', tail: 'fluffy' }, gear: { hat: { base: 'crown', r: 7 }, armor: { base: 'royal', r: 7 }, cape: { base: 'heart', r: 7 }, weapon: { base: 'sword', r: 7 } } },
];

// ---------------------------------------------------------------- ALCHIMIE (potions = consommables, demande au marché)
export const POTIONS = [
  { id: 'p_atk', name: 'Potion de Force', desc: '+30 % ATQ pendant 30 min', boost: 'atk', val: 30, min: 30, cost: [['ratHair', 20], ['dogHair', 10], ['waspWing', 10]], color: '#ff4d5e' },
  { id: 'p_hp', name: 'Potion de Vitalité', desc: '+30 % PV pendant 30 min', boost: 'hp', val: 30, min: 30, cost: [['soil', 20], ['shell', 10], ['snowball', 10]], color: '#62d86b' },
  { id: 'p_gold', name: 'Potion de Fortune', desc: '+100 % or pendant 30 min', boost: 'gold', val: 100, min: 30, cost: [['bolt', 15], ['feather', 15], ['seed', 15]], color: '#ffd54f' },
  { id: 'p_luck', name: 'Potion de Chance', desc: '+100 % de butin pendant 30 min', boost: 'luck', val: 100, min: 30, cost: [['crumb', 2], ['stinger', 2], ['moleClaw', 2]], color: '#5fd068' },
  { id: 'p_royal', name: 'Élixir Royal', desc: '+60 % ATQ et PV pendant 1 h', boost: 'royal', val: 60, min: 60, cost: [['ecto', 3], ['battery', 3], ['magmaCrystal', 3], ['moonShard', 1]], color: '#c77dff' },
];
export const POTION_BY_ID = Object.fromEntries(POTIONS.map((p) => [p.id, p]));
// Transmutation : N ressources d'une rareté → 1 ressource aléatoire de la rareté suivante
export const TRANSMUTE_RATIO = [10, 10, 8, 8, 6, 6];

// ---------------------------------------------------------------- TOUR DES DÉFIS (infinie)
export const TOWER_MODS = [
  { id: 'fortified', name: 'Forteresse', desc: 'Ennemis +80 % PV', enemyHp: 1.8 },
  { id: 'frenzy', name: 'Frénésie', desc: 'Ennemis attaquent 60 % plus vite', enemySpd: 1.6 },
  { id: 'glass', name: 'Canon de verre', desc: 'Vous : +60 % dégâts, −40 % PV', heroAtk: 1.6, heroHp: 0.6 },
  { id: 'silence', name: 'Silence', desc: 'Pouvoirs désactivés', noSkills: true },
  { id: 'alone', name: 'Seul au monde', desc: 'Chatons absents', noKittens: true },
  { id: 'swarm', name: 'Nuée', desc: '+2 ennemis par vague', swarm: 2 },
  { id: 'timer', name: 'Contre-la-montre', desc: 'Victoire en 40 s', timer: 40 },
  { id: 'regen', name: 'Régénération', desc: 'Les ennemis se soignent', regen: 0.03 },
  { id: 'giant', name: 'Géant', desc: 'Un seul ennemi, 6× plus fort', giant: true },
  { id: 'kittenPower', name: 'Pattes de velours', desc: 'Chatons ×3 dégâts', kitMult: 3 },
  { id: 'vampire', name: 'Lune de sang', desc: 'Vous volez 20 % de vie', lifesteal: 20 },
  { id: 'iron', name: 'Peau de fer', desc: 'Ennemis +150 % DÉF, −30 % PV', enemyDef: 2.5, enemyHp: 0.7 },
];
export function towerFloorInfo(f) {
  const boss = f % 10 === 0;
  const h = (f * 2654435761) >>> 0;
  // les étages de gardien n'ont pas de « Géant » (le gardien est déjà seul et énorme)
  const pool = boss ? TOWER_MODS.filter((m) => !m.giant) : TOWER_MODS;
  const mod = f <= 3 ? null : pool[h % pool.length];
  let mod2 = f > 60 && boss ? pool[(h >>> 8) % pool.length] : null;
  if (mod2 && mod && mod2.id === mod.id) mod2 = pool[((h >>> 8) + 1) % pool.length];
  return { boss, mods: [mod, mod2].filter(Boolean) };
}
export function towerFloorReward(f) {
  const r = { towerTokens: 10 + Math.floor(f / 4), gems: f % 5 === 0 ? 10 + Math.floor(f / 10) * 2 : 0 };
  if (f % 5 === 0) { r.artDust = 20 + f; r.yarn = 200 + f * 10; }
  if (f % 10 === 0) { r.eggs = 2 + Math.floor(f / 50); r.frags = 3 + Math.floor(f / 20); }
  if (f % 25 === 0) r.relicKeys = 1;
  return r;
}
// Paliers : cosmétiques et trésors exclusifs (la liste se prolonge à l'infini)
const TM = {
  10: { frame: 'wood' }, 30: { costume: 'snow' }, 25: { title: 'climber', aura: 'sparkle' }, 50: { aura: 'frost', kitten: 'blizzard' }, 75: { costume: 'astronaut', frame: 'ruby' },
  100: { title: 'conqueror', aura: 'thunder' }, 150: { frame: 'rainbow', aura: 'shadow' }, 200: { costume: 'demon' }, 250: { title: 'unstoppable', aura: 'divine' },
  300: { aura: 'galaxy' }, 400: { kitten: 'selene' }, 500: { aura: 'origin' },
};
export function towerMilestone(f) {
  if (TM[f]) return TM[f];
  if (f > 500 && f % 100 === 0) return { relicKeys: 5, gems: 500, frags: 50 };
  return null;
}
export const TOWER_MILESTONES = Object.keys(TM).map(Number);
export const TOWER_SHOP = [
  { id: 't_frags', name: '10 fragments d\'artefact', cost: 300, rewards: { frags: 10 }, limit: 10 },
  { id: 't_dust', name: '200 poussières d\'artefact', cost: 150, rewards: { artDust: 200 }, limit: 20 },
  { id: 't_eggs', name: '3 Paniers', cost: 200, rewards: { eggs: 3 }, limit: 10 },
  { id: 't_stone', name: 'Pierre de protection', cost: 400, rewards: { stone: 1 }, limit: 5 },
  { id: 't_key', name: 'Clé de relique', cost: 900, rewards: { relicKeys: 1 }, limit: 2 },
];
export const TOWER_REVIVE_GEMS = 60;

// ---------------------------------------------------------------- ATTAQUES UNIQUES DES CHATONS
// pattern : orb, multi, rain, beam, chain, nova, dash, spiral, meteor, pillar, wave, boomerang, orbit, spikes, breath
export const KITTEN_ATTACKS = {
  mistigri: { name: 'Feuille tourbillon', pattern: 'multi', shape: 'leaf', n: 3 },
  caramel: { name: 'Boulette de feu', pattern: 'orb', shape: 'flame', n: 1 },
  biscotte: { name: 'Rayon câlin', pattern: 'beam', shape: 'heart', n: 1 },
  charbon: { name: 'Griffe d\'ombre', pattern: 'dash', shape: 'claw', n: 1 },
  flocon: { name: 'Flocons pointus', pattern: 'multi', shape: 'shard', n: 3 },
  poivre: { name: 'Étincelles', pattern: 'chain', shape: 'bolt', n: 2 },
  moka: { name: 'Graine explosive', pattern: 'orb', shape: 'seed', n: 1 },
  praline: { name: 'Bonbons ardents', pattern: 'rain', shape: 'flame', n: 4 },
  grisou: { name: 'Jet d\'eau', pattern: 'beam', shape: 'bubble', n: 1 },
  tigrou: { name: 'Bond du tigre', pattern: 'dash', shape: 'claw', n: 2 },
  noisette: { name: 'Noisettes rebondissantes', pattern: 'multi', shape: 'seed', n: 4 },
  pixel: { name: 'Arc électrique', pattern: 'chain', shape: 'bolt', n: 3 },
  flammeche: { name: 'Queue de comète', pattern: 'meteor', shape: 'flame', n: 1 },
  givre: { name: 'Prison de glace', pattern: 'spikes', shape: 'shard', n: 3 },
  etincelle: { name: 'Tonnerre miniature', pattern: 'pillar', shape: 'bolt', n: 1 },
  mousse: { name: 'Fouet de lianes', pattern: 'wave', shape: 'leaf', n: 1 },
  bulle: { name: 'Bulle géante', pattern: 'orb', shape: 'bubble', n: 1 },
  sushi: { name: 'Lancer de sushis', pattern: 'multi', shape: 'fish', n: 3 },
  ombre: { name: 'Lame fantôme', pattern: 'boomerang', shape: 'claw', n: 1 },
  aurore: { name: 'Aube radieuse', pattern: 'nova', shape: 'star', n: 1 },
  pyro: { name: 'Spirale de feu', pattern: 'spiral', shape: 'flame', n: 5 },
  blizzard: { name: 'Tempête de neige', pattern: 'rain', shape: 'shard', n: 6 },
  volt: { name: 'Éclair zigzag', pattern: 'chain', shape: 'bolt', n: 4 },
  nymphea: { name: 'Vague fleurie', pattern: 'wave', shape: 'bubble', n: 1 },
  sphinxou: { name: 'Malédiction du Sphinx', pattern: 'pillar', shape: 'star', n: 1 },
  ninja: { name: 'Shurikens', pattern: 'multi', shape: 'shuriken', n: 5 },
  corsaire: { name: 'Boulet de canon', pattern: 'meteor', shape: 'cannon', n: 1 },
  samourai: { name: 'Iaï foudroyant', pattern: 'dash', shape: 'bolt', n: 3 },
  sorciere: { name: 'Étoiles filantes', pattern: 'rain', shape: 'star', n: 5 },
  drakou: { name: 'Souffle du dragon', pattern: 'breath', shape: 'flame', n: 1 },
  licorne: { name: 'Arc-en-ciel', pattern: 'beam', shape: 'rainbow', n: 1 },
  kitsune: { name: 'Feux follets', pattern: 'orbit', shape: 'flame', n: 3 },
  polaris: { name: 'Étoile polaire', pattern: 'nova', shape: 'shard', n: 1 },
  seraphin: { name: 'Jugement céleste', pattern: 'pillar', shape: 'star', n: 3 },
  belzechat: { name: 'Flammes infernales', pattern: 'spiral', shape: 'darkflame', n: 7 },
  poseidon: { name: 'Raz-de-marée', pattern: 'wave', shape: 'fish', n: 2 },
  astro: { name: 'Pluie de météores', pattern: 'meteor', shape: 'star', n: 3 },
  selene: { name: 'Rayon lunaire', pattern: 'beam', shape: 'star', n: 2 },
  bastet: { name: 'Colère de Bastet', pattern: 'nova', shape: 'ankh', n: 2 },
  schrodinger: { name: 'Paradoxe quantique', pattern: 'orbit', shape: 'star', n: 6 },
};
// Bannière vedette (rotation hebdomadaire parmi les chatons Divins et Célestes)
export const BANNER_POOL = ['seraphin', 'belzechat', 'poseidon', 'astro', 'selene'];

// ---------------------------------------------------------------- FIDÉLITÉ : récompenses de recharge cumulée (à vie)
export const LOYALTY = [
  { cents: 500, rewards: { gems: 150, eggs: 5 } },
  { cents: 2000, rewards: { aura: 'hearts', relicKeys: 2, frags: 20 } },
  { cents: 5000, rewards: { costume: 'samurai', frags: 40, stone: 3 } },
  { cents: 10000, rewards: { aura: 'money', frags: 80, relicKeys: 5 } },
  { cents: 25000, rewards: { costume: 'angel', title: 'patron', frame: 'flames' } },
  { cents: 50000, rewards: { aura: 'galaxy', frags: 200, relicKeys: 10 } },
  { cents: 100000, rewards: { costume: 'king', frame: 'cosmic' } },
  { cents: 250000, rewards: { aura: 'origin', frags: 600, relicKeys: 30 } },
  { cents: 500000, rewards: { kitten: 'bastet', relicKeys: 50 } },
];
