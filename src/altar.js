// Autel de Bastet : niveaux infinis achetés en gemmes. Chaque niveau donne +1 % ATQ et +1 % PV pour toujours.
// Le coût grandit de 7,5 % par niveau : un objectif sans fin, même pour les plus gros joueurs.
export const ALTAR_PCT = 1;
export function altarCost(lvl) { return Math.round(60 * Math.pow(1.075, lvl)); }
// coût cumulé pour passer de lvl à lvl + n
export function altarCostN(lvl, n) { let s = 0; for (let i = 0; i < n; i++) s += altarCost(lvl + i); return s; }
// tous les 10 niveaux : un trésor
export function altarMilestone(lvl) { return lvl > 0 && lvl % 10 === 0 ? { relicKeys: 1, frags: 10 + lvl / 2 } : null; }
