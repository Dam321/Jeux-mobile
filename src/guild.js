// =====================================================================
//  Guildes (simulées, comme l'arène) : 20 guildes rivales composées des
//  joueurs de l'arène, niveau de guilde, dons, boss de guilde à PV partagés,
//  classement des membres (meilleur assaut) et classement inter-guildes,
//  arbre de bonus acheté avec les écussons, boutique de guilde.
//  Logique pure : testable sous Node.
// =====================================================================
import { seeded, dayKey } from './util.js';
import { weekKey } from './state.js';
import { botPower, botLoadout, daysPlayed } from './pvp.js';
import { stageGold } from './config.js';
import { BIOME_BOSS } from './content.js';
import { BIOMES } from './config.js';

export const GUILD_NAMES = [
  'Les Griffes d\'Argent', 'Ronron Impérial', 'Moustaches de Feu', 'Pattes de Velours', 'Ordre de la Pelote', 'Croquettes Éternelles',
  'Clan du Croissant', 'Les Matous Royaux', 'Félins de l\'Aube', 'Les Sans-Collier', 'Confrérie du Grelot', 'Garde de Bastet',
  'Les Ombres Félines', 'Miaou Nation', 'Les Neuf Vies', 'Royaume du Coussin', 'Escadron Moustache', 'Les Tigres de Papier', 'Lune Rousse', 'Les Chats Perchés',
];
const COLORS = ['#ff4d5e', '#ffcc33', '#4aa9ff', '#62d86b', '#b968ff', '#ff7ae0', '#48f3ff', '#ff9d3c', '#fff27a', '#c77dff'];
export const GUILD_CREATE_GEMS = 300;
export const GUILD_LEAVE_H = 12;
export const GUILD_BOSS_TRIES = 2;
export const GUILD_GEM_DONATIONS = 3;

// ---------------------------------------------------------------- niveaux
export const guildXpNeed = (lvl) => Math.round(2500 * Math.pow(lvl, 1.55));
export function guildLevel(xp) {
  let l = 1, x = Math.max(0, xp);
  while (l < 30 && x >= guildXpNeed(l)) { x -= guildXpNeed(l); l++; }
  return { lvl: l, xp: x, next: guildXpNeed(l), max: l >= 30 };
}
export const guildMaxMembers = (lvl) => 15 + lvl * 2;

// ---------------------------------------------------------------- guildes rivales
// Chaque joueur de l'arène appartient à une guilde ; les baleines sont réparties en tête.
export function makeGuilds(seed, bots) {
  const rnd = seeded(seed + 991);
  const list = GUILD_NAMES.map((name, i) => ({ id: 'g' + i, name, color: COLORS[i % COLORS.length], act: 0.6 + rnd() * 0.8, filler: 6 + Math.floor(rnd() * 14), members: [] }));
  bots.forEach((b, i) => {
    const gi = i < 8 ? i % 4 : Math.floor(rnd() * list.length);
    list[gi].members.push(b.id);
  });
  return list;
}
export function ensureGuilds(st) {
  if (!st.guilds || !st.guilds.length) st.guilds = makeGuilds(st.seed, st.arena.bots);
  const G = st.guild;
  if (G.week !== weekKey()) { G.week = weekKey(); G.best = 0; G.total = 0; G.shop = {}; G.claimedWeek = G.claimedWeek || ''; }
  if (G.day !== dayKey()) { G.day = dayKey(); G.tries = GUILD_BOSS_TRIES; G.checkin = false; G.goldDon = false; G.gemDon = 0; }
}
export function guildById(st, id) {
  if (id === 'mine') return st.guild.mine;
  return (st.guilds || []).find((g) => g.id === id) || null;
}
export function myGuild(st) { return st.guild.id ? guildById(st, st.guild.id) : null; }

// effectif et puissance d'une guilde
export function guildMembers(st, g) {
  const byId = Object.fromEntries(st.arena.bots.map((b) => [b.id, b]));
  const named = g.members.map((id) => byId[id]).filter(Boolean);
  const days = daysPlayed(st);
  const filler = g.id === 'mine' ? Math.min(guildMaxMembers(guildInfo(st, g).lvl) - named.length - 1, 2 + Math.floor((Date.now() - g.created) / 864e5 * 1.5)) : g.filler;
  return { named, filler: Math.max(0, filler), count: named.length + Math.max(0, filler) + (st.guild.id === g.id ? 1 : 0), days };
}
// dégâts d'un assaut de 30 s ≈ 2,2 × la puissance (mesuré en jeu) : échelle fixe, identique pour tous
function botDmgK() { return 2.2; }
// dégâts quotidiens de la guilde sur son boss (hors joueur)
export function guildDailyDmg(st, g) {
  const m = guildMembers(st, g);
  const k = botDmgK(st);
  let sum = 0;
  for (const b of m.named) sum += botPower(st, b) * k * GUILD_BOSS_TRIES;
  const median = m.named.length ? botPower(st, m.named[Math.floor(m.named.length / 2)]) : botPower(st, st.arena.bots[60]);
  sum += m.filler * median * 0.35 * k * GUILD_BOSS_TRIES;
  return sum * (g.act || 1);
}
// niveau / XP de guilde : les membres font des dons tous les jours
export function guildInfo(st, g) {
  const created = g.id === 'mine' ? g.created : st.created - (3 + (g.act || 1) * 40) * 864e5;
  const days = Math.max(0, (Date.now() - created) / 864e5);
  const nMembers = g.id === 'mine' ? 3 + days * 1.5 : g.members.length + g.filler;
  const xp = days * (600 + nMembers * 90) * (g.act || 1) + (st.guild.id === g.id ? st.guild.xpGiven : 0);
  return guildLevel(xp);
}

// ---------------------------------------------------------------- boss de guilde (PV partagés)
export function guildBossOf(week) {
  let hs = 0;
  for (const c of week) hs = (hs * 33 + c.charCodeAt(0)) >>> 0;
  const biome = BIOMES[hs % BIOMES.length].id;
  return { biome, B: BIOME_BOSS[biome] };
}
const bossMax = (base, lvl) => base * Math.pow(1.4, lvl - 1);
// Avance le boss de la guilde du joueur : les autres membres tapent en continu.
// Renvoie le nombre de boss tombés depuis le dernier passage (coffres à réclamer).
export function tickGuildBoss(st, playerDmg = 0) {
  const g = myGuild(st);
  if (!g) return 0;
  const B = st.guild.boss;
  const now = Date.now();
  const daily = guildDailyDmg(st, g);
  if (!B || B.week !== weekKey()) {
    st.guild.boss = { week: weekKey(), lvl: 1, base: Math.max(1, daily * 0.5), hp: 0, t: now, kills: 0 };
    st.guild.boss.hp = bossMax(st.guild.boss.base, 1);
    return 0;
  }
  const dt = Math.min(7, Math.max(0, (now - B.t) / 864e5));
  B.t = now;
  let dmg = daily * dt + playerDmg;
  let kills = 0;
  while (dmg >= B.hp && kills < 50) { dmg -= B.hp; B.lvl++; kills++; B.hp = bossMax(B.base, B.lvl); }
  B.hp -= dmg;
  B.kills += kills;
  st.guild.chests += kills;
  return kills;
}
export function guildBossChest(lvl) { return { guildCoins: 60 + lvl * 8, eggs: 1, artDust: 40 + lvl * 4 }; }

// ---------------------------------------------------------------- classements
// membres : meilleur assaut de la semaine
export function memberBoard(st) {
  const g = myGuild(st);
  if (!g) return [];
  const m = guildMembers(st, g);
  const k = botDmgK(st);
  const wk = weekKey();
  const rows = m.named.map((b) => {
    const r = seeded(b.seed + wk.length * 7 + parseInt(wk.replace(/\D/g, ''), 10) % 9973)();
    return { id: b.id, name: b.name, best: botPower(st, b) * k * (0.7 + r * 0.6), cls: botLoadout(b).ap.cls, power: botPower(st, b) };
  });
  rows.push({ me: true, id: 'me', name: 'Minou (vous)', best: st.guild.best, cls: st.hero.cls, chief: g.id === 'mine' });
  rows.sort((a, b) => b.best - a.best);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
// inter-guildes : dégâts cumulés de la semaine sur leur boss
export function guildBoard(st) {
  const wk = weekKey();
  const elapsed = Math.max(0.2, ((Date.now() - weekStart()) / 864e5));
  const list = [...(st.guilds || [])];
  if (st.guild.mine) list.push(st.guild.mine);
  const rows = list.map((g) => {
    const j = 0.85 + seeded((g.id + wk).split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0)() * 0.3;
    let score = guildDailyDmg(st, g) * elapsed * j;
    if (st.guild.id === g.id) score = guildDailyDmg(st, g) * elapsed + st.guild.total;
    const info = guildInfo(st, g);
    return { id: g.id, name: g.name, color: g.color, lvl: info.lvl, members: guildMembers(st, g).count, score, me: st.guild.id === g.id };
  });
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
function weekStart() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  return d.getTime() - day * 864e5;
}
export function guildRankReward(rank) {
  if (rank === 1) return { guildCoins: 800, gems: 60, relicKeys: 1 };
  if (rank <= 3) return { guildCoins: 600, gems: 40 };
  if (rank <= 6) return { guildCoins: 450, gems: 20 };
  if (rank <= 10) return { guildCoins: 320 };
  return { guildCoins: 200 };
}

// ---------------------------------------------------------------- arbre de guilde
// Les bonus ne s'appliquent que si le joueur est dans une guilde.
export const GUILD_TREE = [
  { tier: 1, need: 1, nodes: [
    { id: 'atk', name: 'Griffes affûtées', fx: 'atk', per: 2, max: 10, base: 40 },
    { id: 'hp', name: 'Fourrure épaisse', fx: 'hp', per: 2, max: 10, base: 40 },
    { id: 'gold', name: 'Bourse commune', fx: 'gold', per: 4, max: 10, base: 40 },
  ] },
  { tier: 2, need: 3, nodes: [
    { id: 'crit', name: 'Instinct du chasseur', fx: 'crit', per: 0.5, max: 10, base: 80 },
    { id: 'afk', name: 'Patrouille organisée', fx: 'afk', per: 5, max: 10, base: 80 },
    { id: 'boss', name: 'Tueurs de titans', fx: 'bossDmg', per: 4, max: 10, base: 80 },
  ] },
  { tier: 3, need: 6, nodes: [
    { id: 'kit', name: 'Nounous de chatons', fx: 'kitDmg', per: 4, max: 10, base: 150 },
    { id: 'luck', name: 'Flair de la meute', fx: 'luck', per: 4, max: 10, base: 150 },
    { id: 'skill', name: 'Grimoire commun', fx: 'skillDmg', per: 4, max: 10, base: 150 },
  ] },
  { tier: 4, need: 10, nodes: [
    { id: 'atk2', name: 'Fureur de la meute', fx: 'atk', per: 3, max: 10, base: 300 },
    { id: 'hp2', name: 'Rempart de guilde', fx: 'hp', per: 3, max: 10, base: 300 },
    { id: 'spd', name: 'Réflexes félins', fx: 'atkSpd', per: 2, max: 10, base: 300 },
  ] },
];
export const TREE_NODES = GUILD_TREE.flatMap((t) => t.nodes.map((n) => ({ ...n, tier: t.tier, need: t.need })));
export const TREE_BY_ID = Object.fromEntries(TREE_NODES.map((n) => [n.id, n]));
export const FX_NAME = { atk: 'ATQ', hp: 'PV', gold: 'or', crit: 'critique', afk: 'butin AFK', bossDmg: 'dégâts aux boss', kitDmg: 'dégâts des chatons', luck: 'butin', skillDmg: 'dégâts des pouvoirs', atkSpd: 'vitesse d\'attaque' };
export function treeCost(n, lvl) { return Math.round(n.base * Math.pow(lvl + 1, 1.5)); }
export function guildFx(st) {
  const out = {};
  if (!st.guild || !st.guild.id) return out;
  for (const id in st.guild.tree) { const n = TREE_BY_ID[id]; if (n) out[n.fx] = (out[n.fx] || 0) + n.per * st.guild.tree[id]; }
  return out;
}

// ---------------------------------------------------------------- dons et boutique
export function goldDonation(st) { return Math.round(stageGold(Math.max(0, st.camp.best - 1)) * 25); }
export const GEM_DONATION = 50;
export const GUILD_SHOP = [
  { id: 'gs_eggs', name: '3 Paniers', cost: 180, rewards: { eggs: 3 }, limit: 5 },
  { id: 'gs_frags', name: '10 fragments d\'artefact', cost: 220, rewards: { frags: 10 }, limit: 5 },
  { id: 'gs_dust', name: '150 poussières d\'artefact', cost: 120, rewards: { artDust: 150 }, limit: 10 },
  { id: 'gs_feathers', name: '5 Plumes', cost: 150, rewards: { feathers: 5 }, limit: 5 },
  { id: 'gs_stone', name: 'Pierre de protection', cost: 300, rewards: { stone: 1 }, limit: 3 },
  { id: 'gs_clover', name: 'Trèfle (butin x2)', cost: 150, rewards: { clover: 1 }, limit: 3 },
  { id: 'gs_key', name: 'Clé de relique', cost: 900, rewards: { relicKeys: 1 }, limit: 1 },
  { id: 'gs_aura', name: 'Aura « Étendard de guilde »', cost: 2500, rewards: { aura: 'banner' }, limit: 1 },
  { id: 'gs_frame', name: 'Cadre « Blason »', cost: 1800, rewards: { frame: 'blazon' }, limit: 1 },
];

// journal de guilde : quelques nouvelles du jour (déterministes) + vos propres actions
export function guildLog(st) {
  const g = myGuild(st);
  if (!g) return [];
  const m = guildMembers(st, g).named;
  const rnd = seeded(dayKey().split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 3) >>> 0);
  const out = [];
  const pick = () => (m.length ? m[Math.floor(rnd() * m.length)].name : 'Un membre');
  const n = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const r = rnd();
    if (r < 0.35) out.push(`${pick()} a fait un don pour la guilde.`);
    else if (r < 0.65) out.push(`${pick()} a frappé le Gardien de guilde.`);
    else if (r < 0.8) out.push(`${pick()} a amélioré l'arbre de guilde.`);
    else if (r < 0.9) out.push(`${pick()} encourage tout le monde pour le classement !`);
    else out.push(`${pick()} est monté dans la Tour des Défis.`);
  }
  return [...(st.guild.log || []).slice(-6).reverse(), ...out];
}
