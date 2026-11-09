// Adaptateur unique pour tous les monstres et boss (enemies.js + enemies2.js)
import { enemySprite, ENEMY_INFO, enemyPortrait, bossSprite, BOSS_INFO, bossPortrait } from './enemies.js';
import { enemySprite2, ENEMY_INFO2, enemyPortrait2, bossSprite2, BOSS_INFO2, bossPortrait2 } from './enemies2.js';

export function monsterInfo(kind) {
  return ENEMY_INFO[kind] || ENEMY_INFO2[kind] || BOSS_INFO[kind] || BOSS_INFO2[kind] || ENEMY_INFO.rat;
}
export function isBossKind(kind) { return !!(BOSS_INFO[kind] || BOSS_INFO2[kind]); }
export function monsterSprite(kind, frame = 0, variant = 0) {
  if (ENEMY_INFO[kind]) return enemySprite(kind, frame, variant);
  if (ENEMY_INFO2[kind]) return enemySprite2(kind, frame, variant);
  if (BOSS_INFO[kind]) return bossSprite(kind, frame, variant);
  if (BOSS_INFO2[kind]) return bossSprite2(kind, frame, variant);
  return enemySprite('rat', frame, variant);
}
export function monsterPortrait(kind, variant = 0) {
  if (ENEMY_INFO[kind]) return enemyPortrait(kind, variant);
  if (ENEMY_INFO2[kind]) return enemyPortrait2(kind, variant);
  if (BOSS_INFO[kind]) return bossPortrait(kind, variant);
  if (BOSS_INFO2[kind]) return bossPortrait2(kind, variant);
  return enemyPortrait('rat', variant);
}
