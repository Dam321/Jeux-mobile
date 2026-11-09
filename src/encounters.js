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

// Une « map » = un chapitre de 10 étapes, avec son décor et ses monstres.
//  - étapes 1-3 : deux espèces, petits groupes ; 4-6 : la troisième espèce arrive ;
//  - étape 5 : mini-boss (deux élites) ; 7-9 : grands groupes et élites ; étape 10 : le boss de la map.
//  - à partir de la 2e ère, un « invité » venu d'une autre map rejoint les rangs (il change à chaque cycle)
//    et les boss portent le titre de leur ère.
const ERA_TITLE = ['', 'du Crépuscule', 'Cauchemardesque', 'Infernal'];
export function guestOf(biome, era) {
  if (era.e < 1) return null;
  const i = BIOMES.findIndex((x) => x.id === biome);
  const other = BIOMES[(i + 3 + era.e * 5) % BIOMES.length].id;
  return BIOME_ENEMIES[other][era.e % 3];
}
export function campaignWaves(ch, stg) {
  const s = stageIndex(ch, stg);
  const biome = biomeForChapter(ch).id;
  const era = eraOf(ch, BIOMES.length);
  const [a, b, c] = BIOME_ENEMIES[biome];
  const guest = guestOf(biome, era);
  const pool = stg <= 3 ? [a, b] : stg <= 6 ? [a, b, c] : guest ? [a, b, c, guest] : [a, b, c];
  const n = stg <= 3 ? 3 : stg <= 6 ? 4 : 5;
  const group = (k, off) => Array.from({ length: k }, (_, i) => mk(pool[(i + off) % pool.length], s));
  const waves = [group(n - 1, 0), group(n, 1)];
  if (era.e >= 1 || stg >= 7) waves[1].push(mk(c, s, 'elite'));
  if (stg === 10) {
    const boss = bossDef(biome, s);
    if (era.e >= 1) boss.name = `${boss.name} ${ERA_TITLE[era.variant] || ''}${era.e >= 4 ? ' ' + era.name.split(' ').pop() : ''}`.trim();
    waves.push([boss]);
  } else if (stg === 5) waves.push([mk(c, s, 'elite'), mk(a, s), mk(b, s), mk(c, s, 'elite')]);
  else waves.push(group(n - 1, 2));
  return { waves, variant: era.variant, era, minions: [a, b], biome, guest };
}

// Récompense du premier passage d'un boss de map : elle grandit avec la progression,
// mais doucement (linéaire) alors que la difficulté est exponentielle.
export function mapClearReward(ch) {
  const r = { gems: 10 + Math.floor(ch / 2), eggs: 1, frags: 2 + Math.floor(ch / 5), feathers: 2 + Math.floor(ch / 10) };
  if (ch % 5 === 0) { r.relicKeys = 1; r.gems += 20; }
  if (ch % BIOMES.length === 0) { r.gems += 150; r.eggs += 5; } // fin d'une ère complète
  return r;
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

// Boss mondial (Titan du jour) : énorme réserve de PV, frappe un peu moins fort ; 30 s pour infliger un max de dégâts
export function worldBossWaves(biome, s) {
  const b = bossDef(biome, s);
  b.hp *= 7; b.atk *= 0.6;
  b.name = 'Titan · ' + b.name;
  b.titan = true;
  return { waves: [[b]], variant: 3, minions: BIOME_ENEMIES[biome].slice(0, 2), biome };
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
