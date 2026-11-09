// Construction des rencontres (campagne, donjons, tour) — pur
import { enemyStats, ENEMY_KINDS, stageIndex, BOSS_NAMES, dungeonStage, towerStage } from './config.js';

function kindsFor(ch) {
  const a = ENEMY_KINDS[(ch - 1) % ENEMY_KINDS.length];
  const b = ENEMY_KINDS[ch % ENEMY_KINDS.length];
  return [a, b];
}

function mk(kind, s, type = 'normal') {
  const st = enemyStats(s, type);
  return { kind, ...st, boss: type === 'boss', elite: type === 'elite', name: type === 'boss' ? BOSS_NAMES[kind] : null };
}

export function campaignWaves(ch, stg) {
  const s = stageIndex(ch, stg);
  const [a, b] = kindsFor(ch);
  const waves = [
    [mk(a, s), mk(a, s), mk(b, s)],
    [mk(b, s), mk(a, s), mk(b, s), mk(a, s)],
  ];
  if (stg === 10) waves.push([mk(a, s, 'boss')]);
  else if (stg % 5 === 0) waves.push([mk(b, s, 'elite'), mk(a, s), mk(a, s)]);
  else waves.push([mk(a, s), mk(b, s), mk(a, s)]);
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
  const w = [mk(kind, s, 'boss')];
  if (floor % 2 === 0) w.push(mk(ENEMY_KINDS[(floor + 1) % 4], s, 'elite'));
  return [w];
}
