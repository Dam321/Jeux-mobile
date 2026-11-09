// Construction des rencontres (campagne, donjons, tour) — pur
import { enemyStats, stageIndex, BOSS_NAMES, dungeonStage, towerStage, biomeForChapter, ENEMY_KINDS } from './config.js';
import { BIOME_ENEMIES, BIOME_BOSS } from './content.js';

function mk(kind, s, type = 'normal', name = null, drop = null) {
  const st = enemyStats(s, type);
  return { kind, ...st, boss: type === 'boss', elite: type === 'elite', name: name || (type === 'boss' ? BOSS_NAMES[kind] || 'Boss' : null), drop };
}

export function campaignWaves(ch, stg) {
  const s = stageIndex(ch, stg);
  const biome = biomeForChapter(ch).id;
  const [a, b, c] = BIOME_ENEMIES[biome];
  const boss = BIOME_BOSS[biome];
  const waves = [
    [mk(a, s), mk(a, s), mk(b, s)],
    [mk(b, s), mk(a, s), mk(c, s), mk(a, s)],
  ];
  if (stg === 10) waves.push([mk(boss.kind, s, 'boss', boss.name, boss.drop)]);
  else if (stg % 5 === 0) waves.push([mk(c, s, 'elite'), mk(a, s), mk(b, s)]);
  else waves.push([mk(a, s), mk(c, s), mk(b, s)]);
  return waves;
}

export function dungeonWaves(id, lvl, kind) {
  const s = dungeonStage(lvl);
  return [
    [mk(kind, s), mk(kind, s), mk(kind, s), mk(kind, s)],
    [mk(kind, s, 'elite'), mk(kind, s), mk(kind, s)],
    [mk(kind, s + 2, 'boss')],
  ];
}

export function towerWaves(floor) {
  const s = towerStage(floor);
  const kind = ENEMY_KINDS[floor % ENEMY_KINDS.length];
  const w = [mk(kind, s, 'boss', `Gardien de l'étage ${floor}`)];
  if (floor % 2 === 0) w.push(mk(ENEMY_KINDS[(floor + 3) % ENEMY_KINDS.length], s, 'elite'));
  return [w];
}
