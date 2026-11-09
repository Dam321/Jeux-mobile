// =====================================================================
//  MIAOU EMPIRE — Contenu v2 : chatons, apparence, costumes, ressources,
//  panoplies (craft), forgemagie, reliques, marché, Guerre des Gouttières.
//  Données pures (aucun import graphique) : utilisables par le simulateur.
// =====================================================================

// ---------------------------------------------------------------- CHATONS (compagnons)
// élément → couleur et nom (effets d'attaque différents en combat)
export const ELEMENTS = {
  fire: { name: 'Feu', color: '#ff7a1a' }, ice: { name: 'Glace', color: '#7fe9ff' }, thunder: { name: 'Foudre', color: '#ffe14d' },
  nature: { name: 'Nature', color: '#5fd068' }, water: { name: 'Eau', color: '#3fa9ff' }, shadow: { name: 'Ombre', color: '#b968ff' },
  light: { name: 'Lumière', color: '#fff2a0' }, cosmic: { name: 'Cosmos', color: '#ff7ae0' },
};
// bonus spécial (en plus de l'ATQ si équipé et des PV possédés)
export const KBONUS = {
  gold: { name: 'Or gagné', unit: '%' }, luck: { name: 'Chance de butin', unit: '%' }, crit: { name: 'Critique', unit: '%' },
  critDmg: { name: 'Dégâts crit.', unit: '%' }, atkSpd: { name: 'Vitesse d\'attaque', unit: '%' }, skillDmg: { name: 'Dégâts compétences', unit: '%' },
  dodge: { name: 'Esquive', unit: '%' }, lifesteal: { name: 'Vol de vie', unit: '%' }, bossDmg: { name: 'Dégâts aux boss', unit: '%' }, hp: { name: 'PV', unit: '%' },
};
const K = (id, name, r, el, look, bonus) => ({ id, name, r, el, look, bonus });
export const KITTENS = [
  // Commun
  K('mistigri', 'Mistigri', 0, 'nature', { fur: 'gris', pattern: 'tabby', eye: 'vert' }, 'gold'),
  K('caramel', 'Caramel', 0, 'fire', { fur: 'roux', pattern: 'solid', eye: 'ambre' }, 'atkSpd'),
  K('biscotte', 'Biscotte', 0, 'light', { fur: 'creme', pattern: 'solid', eye: 'bleu', acc: 'bow', accColor: '#ff7aa8' }, 'hp'),
  K('charbon', 'Charbon', 0, 'shadow', { fur: 'noir', pattern: 'solid', eye: 'or' }, 'crit'),
  K('flocon', 'Flocon', 0, 'ice', { fur: 'blanc', pattern: 'solid', eye: 'bleu' }, 'dodge'),
  K('poivre', 'Poivre', 0, 'thunder', { fur: 'argent', pattern: 'spots', pcolor: '#3a3646', eye: 'vert' }, 'luck'),
  // Peu commun
  K('moka', 'Moka', 1, 'nature', { fur: 'choco', pattern: 'tabby', eye: 'ambre', acc: 'leaf' }, 'gold'),
  K('praline', 'Praline', 1, 'fire', { fur: 'blanc', pattern: 'calico', pcolor: '#e8873a', pcolor2: '#3a3646', eye: 'vert', acc: 'flower', accColor: '#ff7aa8' }, 'luck'),
  K('grisou', 'Grisou', 1, 'water', { fur: 'bleu', pattern: 'solid', eye: 'cuivre', acc: 'bell', accColor: '#3fa9ff' }, 'hp'),
  K('tigrou', 'Tigrou', 1, 'fire', { fur: 'roux', pattern: 'tiger', eye: 'vert', acc: 'bandana', accColor: '#e8323f' }, 'critDmg'),
  K('noisette', 'Noisette', 1, 'nature', { fur: 'cannelle', pattern: 'solid', eye: 'vert', acc: 'flower', accColor: '#ffd84d' }, 'lifesteal'),
  K('pixel', 'Pixel', 1, 'thunder', { fur: 'gris', pattern: 'tuxedo', eye: 'glace', acc: 'star' }, 'atkSpd'),
  // Rare
  K('flammeche', 'Flammèche', 2, 'fire', { fur: 'roux', pattern: 'tiger', pcolor: '#c2410c', eye: 'or', acc: 'flame' }, 'critDmg'),
  K('givre', 'Givre', 2, 'ice', { fur: 'blanc', pattern: 'siamese', pcolor: '#4a7ab8', eye: 'glace', acc: 'ice' }, 'dodge'),
  K('etincelle', 'Étincelle', 2, 'thunder', { fur: 'dore', pattern: 'solid', eye: 'bleu', acc: 'star' }, 'atkSpd'),
  K('mousse', 'Mousse', 2, 'nature', { fur: 'menthe', pattern: 'tabby', pcolor: '#3a9a5a', eye: 'ambre', acc: 'leaf' }, 'lifesteal'),
  K('bulle', 'Bulle', 2, 'water', { fur: 'bleu', pattern: 'spots', pcolor: '#3f6fb8', eye: 'bleu', acc: 'bell', accColor: '#7fe9ff' }, 'hp'),
  K('sushi', 'Sushi', 2, 'water', { fur: 'blanc', pattern: 'calico', pcolor: '#e8873a', pcolor2: '#3a3646', eye: 'cuivre', acc: 'bandana', accColor: '#3fa9ff' }, 'gold'),
  // Épique
  K('ombre', 'Ombre', 3, 'shadow', { fur: 'ombre', pattern: 'solid', eye: 'violet', eyeStyle: 'fierce' }, 'crit'),
  K('aurore', 'Aurore', 3, 'light', { fur: 'dore', pattern: 'solid', eye: 'or', eyeStyle: 'sparkle', acc: 'halo' }, 'hp'),
  K('pyro', 'Pyro', 3, 'fire', { fur: 'fauve', pattern: 'tiger', pcolor: '#8a2a0a', eye: 'rouge', acc: 'flame' }, 'skillDmg'),
  K('blizzard', 'Blizzard', 3, 'ice', { fur: 'argent', pattern: 'tabby', pcolor: '#7aa0d0', eye: 'glace', acc: 'ice', ears: 'lynx' }, 'dodge'),
  K('volt', 'Volt', 3, 'thunder', { fur: 'noir', pattern: 'tiger', pcolor: '#ffe14d', eye: 'or', eyeStyle: 'fierce' }, 'atkSpd'),
  K('nymphea', 'Nymphéa', 3, 'water', { fur: 'lavande', pattern: 'solid', eye: 'bleu', acc: 'flower', accColor: '#7fe9ff' }, 'luck'),
  // Légendaire
  K('sphinxou', 'Sphinxou', 4, 'light', { fur: 'dore', pattern: 'spots', pcolor: '#a8742a', eye: 'glace', acc: 'crown' }, 'gold'),
  K('ninja', 'Mini-Ninja', 4, 'shadow', { fur: 'ombre', pattern: 'solid', eye: 'rouge', eyeStyle: 'fierce', acc: 'bandana', accColor: '#c0182c' }, 'critDmg'),
  K('corsaire', 'Petit Corsaire', 4, 'water', { fur: 'fauve', pattern: 'tabby', eye: 'vert', acc: 'bandana', accColor: '#2a2340' }, 'luck'),
  K('samourai', 'Samouraï', 4, 'thunder', { fur: 'blanc', pattern: 'calico', pcolor: '#e8873a', pcolor2: '#3a3646', eye: 'or', eyeStyle: 'fierce', acc: 'bandana', accColor: '#e8323f' }, 'bossDmg'),
  K('sorciere', 'Petite Sorcière', 4, 'cosmic', { fur: 'noir', pattern: 'solid', eye: 'vert', eyeStyle: 'sparkle', acc: 'star' }, 'skillDmg'),
  // Mythique
  K('drakou', 'Drakou', 5, 'fire', { fur: 'rouge', pattern: 'spots', pcolor: '#8a1a1a', eye: 'or', acc: 'devil', wings: 'dragon' }, 'critDmg'),
  K('licorne', 'Licornette', 5, 'light', { fur: 'blanc', pattern: 'solid', eye: 'rose', eyeStyle: 'sparkle', acc: 'horn', accColor: '#ff7ae0' }, 'hp'),
  K('kitsune', 'Kitsuné', 5, 'fire', { fur: 'roux', pattern: 'siamese', pcolor: '#fff1d6', eye: 'or', ears: 'big', tail: 'fluffy', acc: 'flame' }, 'skillDmg'),
  K('polaris', 'Polaris', 5, 'ice', { fur: 'blanc', pattern: 'solid', eye: 'glace', eyeStyle: 'sparkle', acc: 'ice', tail: 'fluffy' }, 'dodge'),
  // Divin
  K('seraphin', 'Séraphin', 6, 'light', { fur: 'blanc', pattern: 'solid', eye: 'or', eyeStyle: 'sparkle', acc: 'halo', wings: 'angel' }, 'hp'),
  K('belzechat', 'Belzéchat', 6, 'shadow', { fur: 'ombre', pattern: 'solid', eye: 'rouge', eyeStyle: 'fierce', acc: 'devil', wings: 'bat' }, 'critDmg'),
  K('poseidon', 'Poséichaton', 6, 'water', { fur: 'bleu', pattern: 'tabby', pcolor: '#2a5a9a', eye: 'glace', acc: 'crown' }, 'luck'),
  // Céleste
  K('astro', 'Astro', 7, 'cosmic', { fur: 'galaxie', pattern: 'galaxy', eye: 'galaxie', acc: 'star', wings: 'fairy' }, 'skillDmg'),
  K('selene', 'Séléné', 7, 'light', { fur: 'argent', pattern: 'solid', eye: 'glace', eyeStyle: 'sparkle', acc: 'halo', wings: 'fairy' }, 'bossDmg'),
  // Primordial
  K('bastet', 'Bastet', 8, 'light', { fur: 'dore', pattern: 'solid', eye: 'galaxie', eyeStyle: 'sparkle', acc: 'crown', wings: 'angel', ears: 'big' }, 'gold'),
  K('schrodinger', 'Schrödinger', 8, 'cosmic', { fur: 'galaxie', pattern: 'galaxy', eye: 'galaxie', eye2: 'or', eyeStyle: 'sparkle', acc: 'halo', wings: 'fairy', tail: 'fluffy' }, 'luck'),
];
export const KITTEN_BY_ID = Object.fromEntries(KITTENS.map((k) => [k.id, k]));
// Probabilités du Panier (somme = 100)
export const KITTEN_ODDS = [42, 28, 17, 8.5, 3.4, 0.9, 0.18, 0.019, 0.001];
export const KITTEN_PITY_LEG = 60;   // Légendaire ou mieux garanti
export const KITTEN_PITY_MYTH = 600; // Mythique ou mieux garanti
export const KITTEN_ATK_MULT = [0.25, 0.35, 0.5, 0.7, 1.0, 1.5, 2.3, 3.5, 5.5];
export const KITTEN_EQUIP_ATK = [3, 5, 8, 13, 22, 38, 65, 110, 190];
export const KITTEN_OWN_HP = [0.5, 1, 1.5, 2.5, 4, 7, 12, 20, 35];
export const KITTEN_BONUS_VAL = [1, 1.6, 2.5, 4, 6, 9, 14, 22, 35]; // valeur du bonus spécial (×niveau)
export function kittenLevelMult(lvl) { return 1 + 0.2 * (lvl - 1); }

// ---------------------------------------------------------------- APPARENCE (prix en gemmes, 0 = gratuit, 'vipN' / 'pack' / 'ach')
export const LOOK_UNLOCK = {
  fur: { roux: 0, creme: 0, gris: 0, bleu: 0, noir: 0, blanc: 0, choco: 0, cannelle: 0, fauve: 0, lilas: 300, argent: 300, rose: 600, menthe: 600, lavande: 600, dore: 900, ombre: 1200, rouge: 1000, neon: 'vip5', galaxie: 'pack' },
  pattern: { solid: 0, tabby: 0, tuxedo: 0, tiger: 200, calico: 200, spots: 200, siamese: 300, tortie: 300, galaxy: 'pack' },
  eye: { vert: 0, bleu: 0, ambre: 0, or: 0, cuivre: 0, violet: 200, glace: 300, rose: 300, rouge: 500, galaxie: 'pack' },
  eyeStyle: { round: 0, sleepy: 0, fierce: 300, sparkle: 600 },
  ears: { normal: 0, fold: 300, big: 300, lynx: 500 },
  tail: { normal: 0, short: 0, fluffy: 300 },
};
export const PATTERN_COLORS = ['#c2611c', '#7a4a2e', '#3a3646', '#5b3a2b', '#8a8f9e', '#e8873a', '#fbf8f4', '#a8742a', '#4a7ab8', '#8a2a8a', '#2e8a3a', '#c0182c'];
export const HETERO_COST = 800; // yeux vairons

// ---------------------------------------------------------------- COSTUMES (apparence + visuels + bonus permanents)
export const COSTUMES = [
  { id: 'tabby', name: 'Tigré Roux', r: 2, atk: 0, hp: 0, src: 'Par défaut', look: null },
  { id: 'siamese', name: 'Siamois Élégant', r: 3, atk: 0, hp: 6, src: 'Connexion jour 7', look: { fur: 'creme', pattern: 'siamese', eye: 'bleu', eyeStyle: 'sparkle' }, gear: { collar: { base: 'pearls', r: 3 } } },
  { id: 'tux', name: 'Gentleman', r: 3, atk: 6, hp: 0, src: 'Boutique d\'arène', look: { fur: 'noir', pattern: 'tuxedo', eye: 'or' }, gear: { hat: { base: 'tophat', r: 3 }, face: { base: 'monocle', r: 4 } } },
  { id: 'snow', name: 'Flocon des Neiges', r: 3, atk: 4, hp: 8, src: 'Tour des Défis étage 30', look: { fur: 'blanc', eye: 'glace', tail: 'fluffy' }, gear: { hat: { base: 'beanie', r: 7 }, cape: { base: 'star', r: 7 } } },
  { id: 'pirate', name: 'Capitaine Moustache', r: 4, atk: 12, hp: 12, src: 'Passe Royal premium', look: { fur: 'fauve', pattern: 'tabby', eye: 'vert' }, gear: { hat: { base: 'bandana', r: 5 }, face: { base: 'patch', r: 4 }, cape: { base: 'skull', r: 5 }, weapon: { base: 'sword', r: 4 } } },
  { id: 'ninja', name: 'Ninja de l\'Ombre', r: 4, atk: 15, hp: 8, dodge: 3, src: 'Pack Ninja', look: { fur: 'ombre', eye: 'rouge', eyeStyle: 'fierce' }, gear: { face: { base: 'ninja', r: 5 }, armor: { base: 'kimono', r: 5 }, weapon: { base: 'katana', r: 5 } } },
  { id: 'gutter', name: 'Roi des Gouttières', r: 5, atk: 18, hp: 18, src: 'Guerre des Gouttières', look: { fur: 'gris', pattern: 'tabby', eye: 'ambre', ears: 'fold' }, gear: { hat: { base: 'cap', r: 5 }, armor: { base: 'hoodie', r: 5 }, face: { base: 'sun', r: 5 } } },
  { id: 'pharaoh', name: 'Pharaon Doré', r: 5, atk: 22, hp: 22, src: 'VIP 8', look: { fur: 'dore', pattern: 'spots', pcolor: '#a8742a', eye: 'glace' }, gear: { hat: { base: 'crown', r: 4 }, armor: { base: 'royal', r: 4 }, cape: { base: 'star', r: 4 }, weapon: { base: 'staff', r: 4 } } },
  { id: 'cyber', name: 'Cyber Sphynx', r: 5, atk: 30, hp: 25, crit: 5, src: 'Pack Cyber', look: { fur: 'rose', eye: 'glace', ears: 'big' }, gear: { face: { base: 'visor', r: 7 }, armor: { base: 'plate', r: 7 }, wings: { base: 'jetpack', r: 7 }, weapon: { base: 'trident', r: 7 } } },
  { id: 'lion', name: 'Crinière Royale', r: 6, atk: 40, hp: 40, src: 'VIP 12', look: { fur: 'fauve', eye: 'ambre', ears: 'big', tail: 'fluffy' }, gear: { hat: { base: 'crown', r: 6 }, armor: { base: 'royal', r: 6 }, cape: { base: 'heart', r: 5 }, weapon: { base: 'axe', r: 6 } } },
  { id: 'galaxy', name: 'Empereur Cosmique', r: 8, atk: 75, hp: 60, critDmg: 50, src: 'Pack Méga Baleine', look: { fur: 'galaxie', pattern: 'galaxy', eye: 'galaxie', eyeStyle: 'sparkle', ears: 'lynx' }, gear: { hat: { base: 'crown', r: 8 }, armor: { base: 'royal', r: 8 }, cape: { base: 'star', r: 8 }, wings: { base: 'fairy', r: 7 }, weapon: { base: 'scythe', r: 8 } } },
];
export const COSTUME_BY_ID = Object.fromEntries(COSTUMES.map((c) => [c.id, c]));

// ---------------------------------------------------------------- RESSOURCES (butin, craft, marché)
// v = valeur de base au marché (unités relatives à l'économie, voir marketUnit)
const R = (id, name, r, v, icon) => ({ id, name, r, v, icon });
export const RESOURCES = [
  R('ratHair', 'Poil de rat', 0, 1, 'hair'), R('ratWhisker', 'Moustache de rat', 2, 8, 'whisker'),
  R('waspWing', 'Aile de frelon', 0, 1.2, 'wing'), R('stinger', 'Dard de frelon', 2, 9, 'fang'),
  R('soil', 'Terre fertile', 0, 1, 'pile'), R('moleClaw', 'Griffe de taupe', 2, 8, 'fang'),
  R('dogHair', 'Touffe de poil', 0, 1.4, 'hair'), R('dogFang', 'Croc de bouledogue', 2, 10, 'fang'),
  R('scrap', 'Ferraille', 1, 2, 'bolt'), R('crest', 'Écusson de chevalier', 3, 25, 'badge'),
  R('shell', 'Carapace', 0, 1.5, 'shell'), R('goldClaw', 'Pince dorée', 2, 11, 'fang'),
  R('feather', 'Plume grise', 0, 1.2, 'wing'), R('crumb', 'Miette sacrée', 2, 10, 'pile'),
  R('snowball', 'Boule de neige', 0, 1.6, 'orb'), R('frozenCarrot', 'Carotte gelée', 2, 12, 'fang'),
  R('cloth', 'Drap usé', 1, 2.5, 'cloth'), R('ecto', 'Ectoplasme', 3, 28, 'orb'),
  R('bolt', 'Boulon', 0, 2, 'bolt'), R('chip', 'Puce électronique', 2, 14, 'chip'),
  R('neonCable', 'Câble néon', 1, 3, 'cloth'), R('battery', 'Cœur de batterie', 3, 30, 'chip'),
  R('lavaJelly', 'Gelée de lave', 1, 3, 'orb'), R('magmaCrystal', 'Cristal de magma', 3, 32, 'crystal'),
  R('antenna', 'Antenne', 1, 3.5, 'bolt'), R('moonCheese', 'Fromage lunaire', 3, 35, 'pile'),
  R('seed', 'Pépin', 0, 1.5, 'pile'), R('cursedSeed', 'Graine maudite', 3, 26, 'crystal'),
  // butins de boss
  R('ratCrown', 'Couronne rongée', 4, 120, 'badge'), R('cerberusCollar', 'Collier de Cerbère', 4, 140, 'badge'),
  R('titanPearl', 'Perle du Titan', 4, 160, 'orb'), R('iceHeart', 'Cœur de glace', 4, 180, 'crystal'),
  R('turbo', 'Moteur turbo', 4, 200, 'chip'), R('magmaCore', 'Noyau de magma', 4, 230, 'orb'), R('martianBadge', 'Insigne martien', 4, 260, 'badge'),
  // ultra-rares (tous les ennemis)
  R('moonShard', 'Éclat de lune', 5, 400, 'crystal'), R('stardust', 'Poussière d\'étoile', 6, 3000, 'star'), R('bastetTear', 'Larme de Bastet', 8, 80000, 'tear'),
  // v3 : nouvelles maps
  R('sand', 'Sable doré', 0, 1.5, 'pile'), R('stingerS', 'Dard de scorpion', 2, 12, 'fang'),
  R('bandage', 'Bandelette', 0, 1.6, 'cloth'), R('scarab', 'Scarabée d\'or', 3, 30, 'badge'),
  R('banana', 'Banane volée', 0, 1.4, 'fang'), R('monkeyIdol', 'Idole de singe', 2, 13, 'badge'),
  R('scale', 'Écaille', 0, 1.5, 'shell'), R('hypnoEye', 'Œil hypnotique', 3, 28, 'orb'),
  R('tooth', 'Dent de requin', 1, 2.8, 'fang'), R('goggles', 'Lunettes de plongée', 2, 14, 'chip'),
  R('spine', 'Épine de poisson-globe', 0, 1.7, 'fang'), R('pearl', 'Perle noire', 3, 34, 'orb'),
  R('batWing', 'Aile de chauve-souris', 0, 1.8, 'wing'), R('bloodRuby', 'Rubis sanglant', 3, 36, 'crystal'),
  R('bone', 'Os', 0, 1.6, 'bolt'), R('skull', 'Crâne de chien', 2, 15, 'badge'),
  R('gear', 'Engrenage', 1, 3, 'bolt'), R('core', 'Noyau de robot', 3, 38, 'chip'),
  R('tin', 'Fer-blanc', 0, 2, 'shell'), R('label', 'Étiquette maudite', 2, 14, 'cloth'),
  R('blackFeather', 'Plume noire', 0, 1.8, 'wing'), R('shiny', 'Trésor brillant', 2, 16, 'star'),
  R('cloudPuff', 'Bout de nuage', 1, 3.2, 'pile'), R('boltShard', 'Éclat de foudre', 3, 40, 'crystal'),
  R('gelatin', 'Gélatine', 0, 1.6, 'orb'), R('sugarGem', 'Gemme de sucre', 2, 13, 'crystal'),
  R('frosting', 'Glaçage', 0, 1.7, 'pile'), R('cherry', 'Cerise d\'or', 3, 32, 'orb'),
  R('pharaohMask', 'Masque du Pharaon', 4, 170, 'badge'), R('gorillaFist', 'Poing du Gorille', 4, 150, 'badge'),
  R('krakenInk', 'Encre de Kraken', 4, 190, 'tear'), R('royalSugar', 'Sucre royal', 4, 200, 'crystal'),
  R('vampFang', 'Croc du Comte', 4, 220, 'fang'), R('mixerBlade', 'Lame du Mixeur', 4, 240, 'bolt'), R('thunderFeather', 'Plume-Tonnerre', 4, 270, 'wing'),
  R('duskEssence', 'Essence du Crépuscule', 5, 900, 'tear'), R('nightmareEssence', 'Essence de Cauchemar', 6, 4000, 'tear'), R('infernalEssence', 'Essence infernale', 7, 15000, 'tear'),
  // spéciaux
  R('rune', 'Rune de forge', 2, 6, 'rune'), R('gutterBadge', 'Insigne de gouttière', 3, 20, 'badge'), R('artDust', 'Poussière d\'artefact', 3, 12, 'star'),
];
export const RES_BY_ID = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));

// ---------------------------------------------------------------- ENNEMIS par biome + butin
export const BIOME_ENEMIES = {
  garden: ['rat', 'wasp', 'mole'], autumn: ['dog', 'mole', 'knightrat'], beach: ['crab', 'pigeon', 'rat'], jungle: ['monkey', 'snake', 'wasp'],
  desert: ['scorpion', 'mummy', 'snake'], snow: ['yeti', 'pigeon', 'ghost'], underwater: ['shark', 'puffer', 'crab'], candy: ['gummy', 'cupcake', 'wasp'],
  castle: ['bat', 'skeleton', 'ghost'], neon: ['vacuum', 'robodog', 'ghost'], factory: ['gearbot', 'can', 'vacuum'], volcano: ['slime', 'mole', 'robodog'],
  sky: ['crow', 'stormcloud', 'pigeon'], cosmos: ['ufo', 'cucumber', 'ghost'],
};
export const BIOME_BOSS = {
  garden: { boss: 'ratKing', name: 'Roi des Rats', drop: 'ratCrown', skill: 'summon' },
  autumn: { boss: 'cerberus', name: 'Cerbère le Bouledogue', drop: 'cerberusCollar', skill: 'slam' },
  beach: { boss: 'crabTitan', name: 'Crabe Titan', drop: 'titanPearl', skill: 'slam' },
  jungle: { boss: 'gorilla', name: 'Gorille Géant', drop: 'gorillaFist', skill: 'slam' },
  desert: { boss: 'pharaohRat', name: 'Rat-Pharaon', drop: 'pharaohMask', skill: 'summon' },
  snow: { boss: 'yetiLord', name: 'Yéti Suprême', drop: 'iceHeart', skill: 'barrage' },
  underwater: { boss: 'kraken', name: 'Kraken', drop: 'krakenInk', skill: 'barrage' },
  candy: { boss: 'candyQueen', name: 'Reine Guimauve', drop: 'royalSugar', skill: 'summon' },
  castle: { boss: 'vampDog', name: 'Comte Toutoula', drop: 'vampFang', skill: 'drain' },
  neon: { boss: 'vacuumPrime', name: 'Aspirateur Suprême', drop: 'turbo', skill: 'barrage' },
  factory: { boss: 'megaMixer', name: 'Robot Mixeur', drop: 'mixerBlade', skill: 'slam' },
  volcano: { boss: 'magmaKing', name: 'Roi Magma', drop: 'magmaCore', skill: 'barrage' },
  sky: { boss: 'thunderBird', name: 'Oiseau-Tonnerre', drop: 'thunderFeather', skill: 'barrage' },
  cosmos: { boss: 'martianEmperor', name: 'Empereur Martien', drop: 'martianBadge', skill: 'summon' },
};
export const ALL_BOSSES = Object.values(BIOME_BOSS).map((b) => b.boss);
export const ENEMY_DROPS = {
  rat: ['ratHair', 'ratWhisker'], wasp: ['waspWing', 'stinger'], mole: ['soil', 'moleClaw'], dog: ['dogHair', 'dogFang'],
  knightrat: ['scrap', 'crest'], crab: ['shell', 'goldClaw'], pigeon: ['feather', 'crumb'], yeti: ['snowball', 'frozenCarrot'],
  ghost: ['cloth', 'ecto'], vacuum: ['bolt', 'chip'], robodog: ['neonCable', 'battery'], slime: ['lavaJelly', 'magmaCrystal'],
  ufo: ['antenna', 'moonCheese'], cucumber: ['seed', 'cursedSeed'],
  scorpion: ['sand', 'stingerS'], mummy: ['bandage', 'scarab'], monkey: ['banana', 'monkeyIdol'], snake: ['scale', 'hypnoEye'],
  shark: ['tooth', 'goggles'], puffer: ['spine', 'pearl'], bat: ['batWing', 'bloodRuby'], skeleton: ['bone', 'skull'],
  gearbot: ['gear', 'core'], can: ['tin', 'label'], crow: ['blackFeather', 'shiny'], stormcloud: ['cloudPuff', 'boltShard'],
  gummy: ['gelatin', 'sugarGem'], cupcake: ['frosting', 'cherry'],
};
export const DROP_CHANCE = { common: 0.35, rare: 0.05, boss: 0.3 };
export const GLOBAL_DROPS = [['moonShard', 0.003], ['stardust', 0.0003], ['bastetTear', 0.000015]];
export const ENEMY_RANGED = { pigeon: '#d9c79a', wasp: '#ffe14d', ufo: '#7dff9e', ghost: '#b968ff', slime: '#ff7a1a', robodog: '#48f3ff', snake: '#b968ff', shark: '#7fe9ff', bat: '#ff4d5e', crow: '#2a2340', stormcloud: '#ffe14d', cupcake: '#ff9fd8', mummy: '#ffd54f' };

// ---------------------------------------------------------------- PANOPLIES (Atelier)
// Chaque pièce se fabrique au niveau actuel du héros (minimum : niveau de la panoplie).
// cost : ressources par pièce ; les bonus de panoplie s'appliquent selon le nombre de pièces portées.
export const SETS = [
  { id: 'rat', name: 'Panoplie du Roi Rat', lvl: 8, artisan: 1, r: 4, color: '#aeb7c2',
    pieces: { hat: 'crown', armor: 'tunic', cape: 'paw', ring: 'ring' },
    cost: [['ratHair', 25], ['ratWhisker', 4], ['ratCrown', 1]], bonus: { 2: { atk: 10 }, 3: { hp: 12 }, 4: { atk: 15, crit: 3 } } },
  { id: 'cerberus', name: 'Panoplie du Cerbère', lvl: 25, artisan: 5, r: 4, color: '#c98a4b',
    pieces: { hat: 'helmet', armor: 'plate', gloves: 'gauntlet', boots: 'boots', collar: 'spikes' },
    cost: [['dogHair', 40], ['dogFang', 6], ['crest', 2], ['cerberusCollar', 1]], bonus: { 2: { hp: 15 }, 3: { atk: 15 }, 5: { atk: 25, counter: 8 } } },
  { id: 'gutter', name: 'Panoplie des Gouttières', lvl: 35, artisan: 8, r: 5, color: '#7e93b8', pvp: true,
    pieces: { hat: 'cap', face: 'sun', armor: 'hoodie', boots: 'sneakers', weapon: 'claws' },
    cost: [['gutterBadge', 30], ['scrap', 30], ['cloth', 20]], bonus: { 2: { atk: 15 }, 3: { dodge: 5 }, 5: { atk: 30, hp: 30, crit: 6 } } },
  { id: 'titan', name: 'Panoplie du Titan des Mers', lvl: 45, artisan: 12, r: 5, color: '#3fa9ff',
    pieces: { weapon: 'trident', hat: 'viking', armor: 'plate', cape: 'moon', ring: 'gem' },
    cost: [['shell', 50], ['goldClaw', 8], ['crumb', 6], ['titanPearl', 1]], bonus: { 2: { hp: 20 }, 3: { atk: 20 }, 5: { atk: 35, lifesteal: 5 } } },
  { id: 'yeti', name: 'Panoplie du Yéti', lvl: 65, artisan: 18, r: 5, color: '#9ff0ff',
    pieces: { hat: 'beanie', armor: 'hoodie', gloves: 'mitts', boots: 'slippers', cape: 'star', weapon: 'hammer' },
    cost: [['snowball', 60], ['frozenCarrot', 10], ['ecto', 4], ['iceHeart', 1]], bonus: { 2: { hp: 25 }, 4: { atk: 30, dodge: 4 }, 6: { atk: 45, hp: 45, stun: 6 } } },
  { id: 'cyber', name: 'Panoplie Cyber-Matou', lvl: 95, artisan: 28, r: 6, color: '#48f3ff',
    pieces: { face: 'visor', armor: 'plate', wings: 'jetpack', gloves: 'gauntlet', boots: 'sneakers', weapon: 'trident' },
    cost: [['bolt', 80], ['chip', 12], ['battery', 6], ['turbo', 1], ['moonShard', 1]], bonus: { 2: { atk: 30 }, 4: { atkSpd: 20 }, 6: { atk: 60, crit: 8, critDmg: 40 } } },
  { id: 'magma', name: 'Panoplie du Roi Magma', lvl: 135, artisan: 38, r: 6, color: '#ff7a1a',
    pieces: { hat: 'viking', armor: 'royal', cape: 'skull', wings: 'dragon', weapon: 'axe', ring: 'gem' },
    cost: [['lavaJelly', 80], ['magmaCrystal', 12], ['battery', 4], ['magmaCore', 1], ['moonShard', 2]], bonus: { 2: { atk: 40 }, 4: { hp: 50 }, 6: { atk: 80, bossDmg: 60 } } },
  { id: 'martian', name: 'Panoplie de l\'Empereur Martien', lvl: 180, artisan: 48, r: 7, color: '#7dff9e',
    pieces: { hat: 'helmet', face: 'star', armor: 'royal', wings: 'fairy', gloves: 'gauntlet', weapon: 'wand' },
    cost: [['antenna', 90], ['moonCheese', 15], ['cursedSeed', 8], ['martianBadge', 1], ['stardust', 1]], bonus: { 2: { atk: 50 }, 4: { hp: 70, skillDmg: 40 }, 6: { atk: 110, hp: 80, crit: 10 } } },
  { id: 'jungle', name: 'Panoplie de la Jungle', lvl: 40, artisan: 10, r: 5, color: '#5fd068',
    pieces: { hat: 'bandana', armor: 'tunic', weapon: 'bow', boots: 'boots', gloves: 'mitts' },
    cost: [['banana', 50], ['monkeyIdol', 8], ['scale', 20], ['gorillaFist', 1]], bonus: { 2: { atk: 18 }, 3: { atkSpd: 12 }, 5: { atk: 32, combo: 6 } } },
  { id: 'pharaoh', name: 'Panoplie du Rat-Pharaon', lvl: 55, artisan: 14, r: 5, color: '#ffd54f',
    pieces: { hat: 'crown', armor: 'royal', cape: 'star', weapon: 'staff', collar: 'pearls' },
    cost: [['sand', 60], ['scarab', 6], ['stingerS', 6], ['pharaohMask', 1]], bonus: { 2: { hp: 22 }, 3: { skillDmg: 25 }, 5: { atk: 36, hp: 30 } } },
  { id: 'abyss', name: 'Panoplie des Abysses', lvl: 75, artisan: 20, r: 5, color: '#3fa9ff',
    pieces: { hat: 'helmet', armor: 'plate', weapon: 'trident', cape: 'moon', ring: 'gem' },
    cost: [['spine', 60], ['pearl', 6], ['goggles', 8], ['krakenInk', 1]], bonus: { 2: { hp: 28 }, 3: { lifesteal: 5 }, 5: { atk: 40, hp: 40 } } },
  { id: 'sugar', name: 'Panoplie Sucrée', lvl: 85, artisan: 24, r: 6, color: '#ff9fd8',
    pieces: { hat: 'party', armor: 'hoodie', weapon: 'ladle', boots: 'slippers', collar: 'bell', wings: 'butterfly' },
    cost: [['gelatin', 70], ['sugarGem', 10], ['cherry', 5], ['royalSugar', 1]], bonus: { 2: { hp: 30 }, 4: { luck: 60 }, 6: { atk: 55, hp: 55, dodge: 6 } } },
  { id: 'vampire', name: 'Panoplie du Comte', lvl: 110, artisan: 32, r: 6, color: '#b3202f',
    pieces: { hat: 'tophat', face: 'monocle', armor: 'royal', cape: 'skull', wings: 'bat', weapon: 'scythe' },
    cost: [['batWing', 80], ['bloodRuby', 10], ['skull', 10], ['vampFang', 1], ['moonShard', 1]], bonus: { 2: { atk: 35 }, 4: { lifesteal: 10 }, 6: { atk: 70, critDmg: 50 } } },
  { id: 'mecha', name: 'Panoplie Méca', lvl: 125, artisan: 36, r: 6, color: '#9aa7b8',
    pieces: { hat: 'helmet', face: 'visor', armor: 'plate', wings: 'jetpack', gloves: 'gauntlet', weapon: 'hammer' },
    cost: [['gear', 80], ['core', 10], ['label', 10], ['mixerBlade', 1], ['moonShard', 1]], bonus: { 2: { hp: 40 }, 4: { atk: 40 }, 6: { atk: 75, hp: 60, stun: 8 } } },
  { id: 'storm', name: 'Panoplie de la Tempête', lvl: 160, artisan: 44, r: 7, color: '#ffe14d',
    pieces: { hat: 'wizard', face: 'star', armor: 'robe', wings: 'angel', cape: 'star', weapon: 'wand' },
    cost: [['cloudPuff', 90], ['boltShard', 12], ['shiny', 12], ['thunderFeather', 1], ['stardust', 1]], bonus: { 2: { atk: 45 }, 4: { skillDmg: 60 }, 6: { atk: 100, crit: 10 } } },
  { id: 'dusk', name: 'Panoplie du Crépuscule', lvl: 200, artisan: 52, r: 7, color: '#ff9d6b',
    pieces: { hat: 'crown', face: 'sun', armor: 'kimono', cape: 'moon', wings: 'dragon', weapon: 'katana', boots: 'boots' },
    cost: [['duskEssence', 3], ['moonShard', 3], ['scarab', 10], ['hypnoEye', 10]], bonus: { 2: { atk: 60 }, 4: { hp: 80 }, 7: { atk: 140, hp: 120, critDmg: 80 } } },
  { id: 'nightmare', name: 'Panoplie du Cauchemar', lvl: 300, artisan: 70, r: 8, color: '#8a3cff',
    pieces: { hat: 'helmet', face: 'patch', armor: 'royal', cape: 'skull', wings: 'bat', weapon: 'scythe', gloves: 'gauntlet', ring: 'gem' },
    cost: [['nightmareEssence', 3], ['stardust', 2], ['bloodRuby', 15], ['core', 15]], bonus: { 2: { atk: 80 }, 4: { hp: 120 }, 8: { atk: 260, hp: 220, crit: 12 } } },
  { id: 'infernal', name: 'Panoplie Infernale', lvl: 400, artisan: 85, r: 8, color: '#ff4d1a',
    pieces: { hat: 'viking', face: 'visor', armor: 'plate', cape: 'skull', wings: 'dragon', weapon: 'axe', boots: 'boots', collar: 'spikes' },
    cost: [['infernalEssence', 3], ['stardust', 3], ['magmaCore', 3], ['boltShard', 20]], bonus: { 2: { atk: 110 }, 4: { hp: 160 }, 8: { atk: 380, hp: 300, bossDmg: 150 } } },
  { id: 'bastet', name: 'Panoplie de Bastet', lvl: 250, artisan: 60, r: 8, color: '#fff27a',
    pieces: { hat: 'crown', face: 'monocle', armor: 'royal', cape: 'star', wings: 'angel', weapon: 'staff', collar: 'pearls', ring: 'gem' },
    cost: [['moonShard', 6], ['stardust', 3], ['bastetTear', 1], ['crest', 10], ['ecto', 10]], bonus: { 2: { atk: 60 }, 4: { hp: 100 }, 6: { atk: 150, crit: 12 }, 8: { atk: 250, hp: 200, critDmg: 100 } } },
];
export const SET_BY_ID = Object.fromEntries(SETS.map((s) => [s.id, s]));
export function artisanXpNext(lvl) { return Math.round(30 + 4 * Math.pow(lvl, 1.5)); }
export function craftXp(S) { return Math.round(30 * (S.r - 1) * (1 + S.lvl / 50)); }
export function craftGold(itemLevel, setR) { return Math.round(300 * Math.pow(1.06, itemLevel) * (1 + setR * 0.5)); }

// ---------------------------------------------------------------- FORGEMAGIE
export const FORGE_MAX = 15;
export const FORGE_RATES = [95, 90, 82, 74, 66, 58, 50, 42, 34, 27, 20, 14, 9, 6, 4]; // % de réussite pour passer à +1..+15
export const FORGE_BONUS = 0.09; // +9 % de stats principales par niveau
export function forgeCost(item) {
  const n = item.upg || 0;
  return { rune: Math.round((n + 1) * (n + 2) * (1 + item.r * 0.4)), gold: Math.round(80 * Math.pow(1.06, item.l) * (n + 1) * (n + 1)) };
}
export function breakRunes(item) {
  return Math.max(1, Math.round((item.r + 1) * (item.r + 1) * 0.6 * (1 + item.l / 60) * (item.set ? 3 : 1)));
}

// ---------------------------------------------------------------- RELIQUES (ultra-rares, effets spéciaux)
export const RELICS = [
  { id: 'excalipatte', name: 'Excalipatte', slot: 'weapon', base: 'sword', fx: { atk: 25 }, perk: 'double', desc: '+25 % ATQ · 12 % de chance de frapper deux fois' },
  { id: 'bastetCrown', name: 'Couronne de Bastet', slot: 'hat', base: 'crown', fx: { atk: 15, hp: 15 }, desc: '+15 % ATQ et PV' },
  { id: 'schroGlasses', name: 'Lunettes de Schrödinger', slot: 'face', base: 'star', fx: { dodge: 15 }, desc: '+15 % d\'esquive' },
  { id: 'nightCape', name: 'Cape de la Nuit Éternelle', slot: 'cape', base: 'moon', fx: { critDmg: 60 }, desc: '+60 % de dégâts critiques' },
  { id: 'phoenixWings', name: 'Ailes du Phénix', slot: 'wings', base: 'angel', fx: { hp: 20 }, perk: 'revive', desc: '+20 % PV · ressuscite une fois par combat' },
  { id: 'lionArmor', name: 'Armure du Lion Céleste', slot: 'armor', base: 'royal', fx: { hp: 30 }, desc: '+30 % PV' },
  { id: 'midasGloves', name: 'Gants de Midas', slot: 'gloves', base: 'gauntlet', fx: { gold: 60 }, desc: '+60 % d\'or gagné' },
  { id: 'sevenBoots', name: 'Bottes de Sept Lieues', slot: 'boots', base: 'boots', fx: { atkSpd: 30 }, desc: '+30 % de vitesse d\'attaque' },
  { id: 'destinyBell', name: 'Grelot du Destin', slot: 'collar', base: 'bell', fx: { luck: 100 }, desc: '+100 % de chance de butin' },
  { id: 'nineRing', name: 'Anneau des 9 Vies', slot: 'ring', base: 'gem', fx: { hp: 25, lifesteal: 8 }, desc: '+25 % PV · +8 % vol de vie' },
];
export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));
export const RELIC_CHEST = { cost1: 300, cost10: 2800, relicPct: 0.25, pity: 300 };
// lots de consolation du coffre des reliques (probabilités cumulées affichées en jeu)
export const RELIC_CONSOLATION = [
  { p: 30, rewards: { yarn: 600 } }, { p: 20, rewards: { eggs: 2 } }, { p: 18, rewards: { rune: 30 } }, { p: 12, rewards: { feathers: 4 } },
  { p: 9, rewards: { stone: 1 } }, { p: 6, rewards: { clover: 1 } }, { p: 3.5, rewards: { moonShard: 1 } }, { p: 1.25, rewards: { stardust: 1 } },
];
export const BOX_RELIC_CHANCE = 0.000005; // 1 chance sur 200 000 par carton

// ---------------------------------------------------------------- MARCHÉ (Hôtel des ventes)
export const MARKET_TAX = 0.02; // taxe de mise en vente (comme l'HDV de Dofus)
export const MARKET_LOTS = [1, 10, 100];
export const MARKET_QUICK_SELL = 0.55; // revente immédiate au marchand
export function marketSlots(vip) { return 8 + vip * 2; }

// ---------------------------------------------------------------- GUERRE DES GOUTTIÈRES
export const CLANS = [
  { id: 'me', name: 'Moustaches Rebelles', color: '#ffcc33' },
  { id: 'claws', name: 'Griffes Noires', color: '#ff4d5e' },
  { id: 'port', name: 'Matous du Port', color: '#4aa9ff' },
  { id: 'roofs', name: 'Gang des Toits', color: '#62d86b' },
];
export const TERRITORIES = [
  { id: 't1', name: 'Gouttière du Boulanger', pts: 1 }, { id: 't2', name: 'Toit de l\'Opéra', pts: 2 }, { id: 't3', name: 'Cheminée Rouge', pts: 1 },
  { id: 't4', name: 'Marché aux Poissons', pts: 2 }, { id: 't5', name: 'Clocher Saint-Matou', pts: 2 }, { id: 't6', name: 'Ruelle aux Poubelles', pts: 1 },
  { id: 't7', name: 'Pont des Chats', pts: 1 }, { id: 't8', name: 'Tour aux Croquettes', pts: 4 }, { id: 't9', name: 'Antenne TV', pts: 1 },
  { id: 't10', name: 'Jardin Suspendu', pts: 2 }, { id: 't11', name: 'Lucarne Dorée', pts: 2 }, { id: 't12', name: 'Château d\'Eau', pts: 1 },
];
export const WAR_ENERGY = 5;
export const WAR_SHOP = [
  { id: 'w_costume', name: 'Costume Roi des Gouttières', cost: 400, rewards: { costume: 'gutter' }, limit: 1 },
  { id: 'w_badges', name: '10 Insignes de gouttière', cost: 60, rewards: { gutterBadge: 10 }, limit: 20 },
  { id: 'w_eggs', name: '3 Paniers', cost: 90, rewards: { eggs: 3 }, limit: 5 },
  { id: 'w_stone', name: 'Pierre de protection', cost: 150, rewards: { stone: 1 }, limit: 3 },
];
