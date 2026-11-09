// Classes de chat et spécialisations (données pures, partagées par les stats, l'économie,
// le simulateur et le moteur de combat).
//
// Équilibrage : chaque classe a le même « budget » de puissance, réparti différemment
// (dégâts, survie, contrôle). Les spécialisations ajoutent ~+20 % d'efficacité dans leur domaine.
// Valeurs réglées avec scripts/classes.mjs : sur 25 jours, toutes les spécialisations finissent à ±2 étapes l'une de l'autre.

export const SPEC_LEVEL = 25; // niveau de héros pour choisir sa spécialisation
export const CLASS_CHANGE_GEMS = 800; // le premier changement de classe est gratuit
export const SPEC_CHANGE_GEMS = 300; // le premier choix de spécialisation est gratuit

export const CLASSES = [
  {
    id: 'botte', name: 'Chat Botté', role: 'Épéiste', color: '#ff4d5e', accent: '#ffd23f', style: 'slash',
    tagline: 'Panache, rapière et riposte.',
    desc: 'Un escrimeur flamboyant au chapeau à plume. Il enchaîne les coups rapides et punit chaque erreur adverse.',
    weapons: ['sword', 'fish'], armors: ['royal', 'tunic'],
    look: { fur: 'roux', pattern: 'tabby', eye: 'vert' },
    showcase: { weapon: 'sword', armor: 'royal', r: 5 },
    base: { atk: 6, hp: 6, crit: 3, atkSpd: 12 },
    ult: { name: 'Estocade Royale', mult: 3.6, aoe: false },
    specs: [
      { id: 'duel', name: 'Duelliste Flamboyant', icon: '⚔', desc: 'Critiques en cascade : +8 % de critique, +30 % de dégâts critiques. L\'Estocade Royale revient toutes les 4 attaques au lieu de 5.', fx: { crit: 8, critDmg: 30 }, mech: { ultEvery: 4 } },
      { id: 'garde', name: 'Fine Lame Royale', icon: '🛡', desc: 'Pare 20 % des coups ennemis (aucun dégât) et riposte à chaque parade. +15 % PV.', fx: { hp: 15 }, mech: { parry: 20 } },
    ],
  },
  {
    id: 'noir', name: 'Chat Noir', role: 'Mage', color: '#b968ff', accent: '#48f3ff', style: 'magic',
    tagline: 'Les arcanes de la nuit.',
    desc: 'Porte-malheur pour ses ennemis. Ses sorts frappent fort et loin, mais il est plus fragile.',
    weapons: ['staff', 'wand'], armors: ['robe'],
    look: { fur: 'noir', pattern: 'solid', eye: 'violet' },
    showcase: { weapon: 'staff', armor: 'robe', r: 5 },
    base: { atk: 12, hp: -6, skillDmg: 30 },
    ult: { name: 'Nova des Ombres', mult: 2.1, aoe: true },
    specs: [
      { id: 'ombres', name: 'Sorcier des Ombres', icon: '☾', desc: 'Chaque attaque maudit la cible : elle subit +8 % de dégâts, cumulable 5 fois. +4 % de vol de vie.', fx: { lifesteal: 4 }, mech: { curse: 8, curseMax: 5 } },
      { id: 'astro', name: 'Astromancien', icon: '✦', desc: 'Pouvoirs rechargés 25 % plus vite, +50 % de dégâts des pouvoirs.', fx: { skillDmg: 50 }, mech: { cdr: 25 } },
    ],
  },
  {
    id: 'tigre', name: 'Chat Tigré', role: 'Berserker', color: '#ff7a1a', accent: '#c4122c', style: 'smash',
    tagline: 'Rage, crocs et fourrure.',
    desc: 'Une montagne de muscles rayés. Plus il saigne, plus il frappe fort, et ses haches fendent les rangs.',
    weapons: ['axe', 'hammer'], armors: ['plate'],
    look: { fur: 'roux', pattern: 'tiger', eye: 'ambre' },
    showcase: { weapon: 'axe', armor: 'plate', r: 5 },
    base: { atk: 4, hp: 16, lifesteal: 3 },
    ult: { name: 'Rugissement Sanglant', mult: 2.2, aoe: true, heal: 0.06 },
    specs: [
      { id: 'fureur', name: 'Fureur Rugissante', icon: '🔥', desc: 'Jusqu\'à +60 % de dégâts quand ses PV baissent. +5 % de vol de vie.', fx: { lifesteal: 5 }, mech: { rage: 60 } },
      { id: 'rempart', name: 'Rempart de Fourrure', icon: '⛨', desc: 'Bouclier de 18 % des PV toutes les 8 s. +20 % PV, +30 % DÉF.', fx: { hp: 20, def: 30 }, mech: { shieldEvery: 8, shieldPct: 0.18 } },
    ],
  },
  {
    id: 'ninja', name: 'Chat Ninja', role: 'Assassin', color: '#ff2a3d', accent: '#2a2a3a', style: 'slash',
    tagline: 'Une ombre sur les toits.',
    desc: 'Silencieux, insaisissable, mortel. Il esquive, frappe deux fois et disparaît dans la fumée.',
    weapons: ['katana', 'claws'], armors: ['kimono', 'hoodie'],
    look: { fur: 'ombre', pattern: 'solid', eye: 'rouge' },
    showcase: { weapon: 'katana', armor: 'kimono', r: 5 },
    base: { atk: 6, atkSpd: 15, dodge: 4, combo: 4 },
    ult: { name: 'Danse des Mille Lames', mult: 1.5, aoe: true },
    specs: [
      { id: 'ombre', name: 'Ombre des Toits', icon: '☁', desc: '+13 % d\'esquive, +14 % de combo : il frappe souvent deux fois.', fx: { dodge: 13, combo: 14 } },
      { id: 'venin', name: 'Griffe Venimeuse', icon: '☠', desc: 'Chaque coup empoisonne : 25 % de l\'ATQ par seconde pendant 4 s, cumulable 5 fois.', fx: {}, mech: { poison: 0.25, poisonMax: 5, poisonDur: 4 } },
    ],
  },
  {
    id: 'siamois', name: 'Chat Siamois', role: 'Chasseur', color: '#62d86b', accent: '#ffd23f', style: 'arrow',
    tagline: 'Il ne rate jamais sa proie.',
    desc: 'Un archer au regard bleu glacial. Il tire de loin, vise les points faibles et arrose les groupes.',
    weapons: ['bow', 'trident'], armors: ['tunic', 'hoodie'],
    look: { fur: 'creme', pattern: 'siamese', eye: 'bleu' },
    showcase: { weapon: 'bow', armor: 'tunic', r: 5 },
    base: { atk: 6, crit: 6, critDmg: 30 },
    ult: { name: 'Pluie de Flèches', mult: 1.8, aoe: true },
    specs: [
      { id: 'faucon', name: 'Œil de Faucon', icon: '◎', desc: 'Le premier coup sur chaque ennemi est toujours critique. +60 % de dégâts critiques.', fx: { critDmg: 60 }, mech: { firstCrit: true } },
      { id: 'volee', name: 'Maître de la Volée', icon: '➶', desc: 'Chaque attaque touche aussi un second ennemi à 60 %. +10 % de vitesse d\'attaque.', fx: { atkSpd: 10 }, mech: { multishot: 0.6 } },
    ],
  },
  {
    id: 'sphynx', name: 'Chat Sphynx', role: 'Faucheur', color: '#48f3a0', accent: '#b968ff', style: 'slash',
    tagline: 'Il fauche les âmes des nuisibles.',
    desc: 'Sans poils, sans pitié. Sa faux spectrale moissonne les rangs ennemis et nourrit ses âmes errantes.',
    weapons: ['scythe'], armors: ['robe', 'kimono'],
    look: { fur: 'rose', pattern: 'solid', eye: 'glace' },
    showcase: { weapon: 'scythe', armor: 'robe', r: 5 },
    base: { atk: 8, hp: 4, bossDmg: 15 },
    ult: { name: 'Moisson des Âmes', mult: 2.4, aoe: true, heal: 0.04 },
    specs: [
      { id: 'moisson', name: 'Grand Moissonneur', icon: '☽', desc: 'Achève les ennemis sous 15 % de PV (hors boss). +25 % de dégâts aux boss.', fx: { bossDmg: 25 }, mech: { execute: 0.15 } },
      { id: 'ames', name: 'Seigneur des Âmes', icon: '♨', desc: 'Chaque ennemi vaincu libère une âme : soigne 5 % des PV et donne +5 % d\'ATQ (10 fois max par combat). Chatons +20 % de dégâts.', fx: { kitDmg: 20 }, mech: { soulHeal: 0.05, soulAtk: 5, soulMax: 10 } },
    ],
  },
];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

export function classOf(st) { return (st && st.hero && CLASS_BY_ID[st.hero.cls]) || null; }
export function specOf(st) {
  const C = classOf(st);
  return C && st.hero.spec ? C.specs.find((s) => s.id === st.hero.spec) || null : null;
}

// Restriction d'équipement : armes et armures réservées à la classe ; le reste est libre.
// Les reliques s'adaptent à toutes les classes.
export const CLASS_SLOTS = ['weapon', 'armor'];
export function allowedBases(cls, slot) {
  const C = CLASS_BY_ID[cls];
  if (!C || !CLASS_SLOTS.includes(slot)) return null;
  return slot === 'weapon' ? C.weapons : C.armors;
}
export function canEquip(cls, it) {
  if (!it || it.relic) return true;
  const a = allowedBases(cls, it.slot);
  return !a || a.includes(it.base);
}
export function classesFor(it) {
  if (!it || it.relic || !CLASS_SLOTS.includes(it.slot)) return null;
  return CLASSES.filter((c) => (it.slot === 'weapon' ? c.weapons : c.armors).includes(it.base));
}
// base adaptée à la classe (reliques, pièces de panoplie fabriquées)
export function adaptBase(cls, slot, base) {
  const a = allowedBases(cls, slot);
  return !a || a.includes(base) ? base : a[0];
}

// Mécaniques de combat cumulées (classe + spécialisation)
export function classMech(cls, spec) {
  const C = CLASS_BY_ID[cls];
  if (!C) return null;
  const S = C.specs.find((s) => s.id === spec);
  return { cls: C.id, color: C.color, accent: C.accent, style: C.style, ult: C.ult, ultEvery: 5, ...(S ? S.mech || {} : {}), spec: S ? S.id : null };
}
