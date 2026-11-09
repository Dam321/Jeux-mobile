// Construction des rencontres (campagne, donjons, tour) — pur
import { enemyStats, stageIndex, dungeonStage, towerStage, biomeForChapter, BIOMES } from './config.js';
import { BIOME_ENEMIES, BIOME_BOSS, ALL_BOSSES } from './content.js';
import { eraOf } from './content3.js';

function mk(kind, s, type = 'normal', extra = {}) {
  const st = enemyStats(s, type);
  return { kind, ...st, boss: type === 'boss', elite: type === 'elite', name: null, ...extra };
}
function bossDef(biome, s, type = 'boss') {
  const B = BIOME_BOSS[biome];
  return mk(BIOME_ENEMIES[biome][0], s, type, { bossKind: B.boss, name: B.name, drop: B.drop, skill: B.skill });
}

// Une « map » = un chapitre de 10 étapes ; l'étape 5 a un mini-boss, l'étape 10 le boss de la map.
export function campaignWaves(ch, stg) {
  const s = stageIndex(ch, stg);
  const biome = biomeForChapter(ch).id;
  const era = eraOf(ch, BIOMES.length);
  const [a, b, c] = BIOME_ENEMIES[biome];
  const waves = [
    [mk(a, s), mk(a, s), mk(b, s)],
    [mk(b, s), mk(a, s), mk(c, s), mk(a, s)],
  ];
  if (era.e >= 1) waves[1].push(mk(c, s, 'elite'));
  if (stg === 10) waves.push([bossDef(biome, s)]);
  else if (stg === 5) waves.push([mk(c, s, 'elite'), mk(a, s), mk(b, s), mk(c, s, 'elite')]);
  else waves.push([mk(a, s), mk(c, s), mk(b, s)]);
  return { waves, variant: era.variant, era, minions: [a, b], biome };
}

export function dungeonWaves(id, lvl, kind) {
  const s = dungeonStage(lvl);
  return [
    [mk(kind, s), mk(kind, s), mk(kind, s), mk(kind, s)],
    [mk(kind, s, 'elite'), mk(kind, s), mk(kind, s)],
    [mk(kind, s + 2, 'boss', { bossKind: { rat: 'ratKing', vacuum: 'vacuumPrime', dog: 'cerberus' }[kind] || 'ratKing', name: 'Gardien du donjon', skill: 'slam' })],
  ];
}

// Repaire de boss : rejouer un boss de map déjà vaincu (matériaux de craft)
export function lairWaves(biome, s, variant = 0) {
  const [a, b, c] = BIOME_ENEMIES[biome];
  return { waves: [[mk(a, s), mk(b, s), mk(c, s, 'elite')], [bossDef(biome, s)]], variant, minions: [a, b], biome };
}

// Tour des Défis : vagues selon l'étage et ses modificateurs ; un boss tous les 10 étages
export function towerWaves(floor, mods = []) {
  const s = towerStage(floor);
  const biomes = BIOMES.map((b) => b.id);
  const biome = biomes[Math.floor(floor / 10) % biomes.length];
  const [a, b, c] = BIOME_ENEMIES[biome];
  const swarm = mods.reduce((n, m) => n + (m.swarm || 0), 0);
  const giant = mods.some((m) => m.giant);
  let waves;
  if (floor % 10 === 0) {
    const B = BIOME_BOSS[biome];
    waves = [[mk(a, s), mk(b, s), mk(c, s)], [mk(a, s, 'boss', { bossKind: ALL_BOSSES[(floor / 10) % ALL_BOSSES.length] || B.boss, name: `Gardien de l'étage ${floor}`, skill: ['slam', 'barrage', 'summon', 'drain'][(floor / 10) % 4], drop: B.drop })]];
  } else if (giant) waves = [[mk(c, s, 'elite', { giant: true })]];
  else waves = [[mk(a, s), mk(b, s), mk(c, s)], [mk(b, s), mk(c, s, 'elite'), mk(a, s)]];
  if (swarm) for (const w of waves) for (let i = 0; i < swarm; i++) w.push(mk(a, s));
  return { waves, variant: Math.min(3, Math.floor(floor / 50)), minions: [a, b], biome };
}
