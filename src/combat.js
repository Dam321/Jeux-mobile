// Formules de combat partagées (moteur visuel + simulateur d'équilibrage)
import { SKILL_BY_ID, kittenStats, skillLevelMult } from './stats.js';

export const BASE_INTERVAL = 1.0;

export function hitDamage(atk, def) {
  return (atk * atk) / (atk + Math.max(0, def));
}

export function attackInterval(stats) {
  return BASE_INTERVAL / (1 + (stats.atkSpd || 0) / 100);
}

// Résout une attaque de base. Retourne { dmg, crit }
export function rollAttack(att, defStats, mult = 1, isBoss = false) {
  let d = hitDamage(att.atk, defStats.def) * mult;
  const crit = Math.random() * 100 < att.crit;
  if (crit) d *= 1 + att.critDmg / 100;
  if (isBoss && att.bossDmg) d *= 1 + att.bossDmg / 100;
  d *= 0.92 + Math.random() * 0.16;
  return { dmg: d, crit };
}

export function equippedSkills(st, slots) {
  const out = [];
  for (let i = 0; i < slots; i++) {
    const id = st.skills.equipped[i];
    if (id && st.skills.owned[id]) out.push({ ...SKILL_BY_ID[id], lvl: st.skills.owned[id].lvl, lm: skillLevelMult(st.skills.owned[id].lvl) });
  }
  return out;
}
export function equippedKittens(st, slots) {
  const out = [];
  for (let i = 0; i < slots; i++) {
    const id = st.kittens.equipped[i];
    if (id && st.kittens.owned[id]) { const ks = kittenStats(st, id); out.push({ ...ks.k, lvl: st.kittens.owned[id].lvl, mult: ks.atkMult, lm: 1 }); }
  }
  return out;
}
export const equippedPets = equippedKittens;

// Simulation rapide (sans visuel) d'un combat : joueur vs vagues d'ennemis.
// enemies : [[{hp,atk,def,interval,boss}...], ...]
// M : mécaniques de classe (classes.js → classMech) ou null (coup final générique x2,5 toutes les 5 attaques)
export function quickFight(P, skills, pets, waves, timeLimit = 90, M = null) {
  let hp = P.hp, shield = 0, t = 0;
  const dt = 0.05;
  const interval = attackInterval(P);
  let atkT = 0, atkN = 0, souls = 0, shT = M && M.shieldEvery ? M.shieldEvery - 1 : 0;
  const cds = skills.map((s) => s.cd * 0.5);
  const petT = pets.map(() => 1);
  const cdr = 1 + ((M && M.cdr) || 0) / 100;
  const every = M ? M.ultEvery : 5;
  let buff = 0, buffT = 0;
  for (const wave of waves) {
    const es = wave.map((e) => ({ ...e, cur: e.hp, t: e.interval * (0.6 + Math.random() * 0.6), stun: 0 }));
    const alive = () => es.filter((e) => e.cur > 0);
    const hit = (e, mult, skill, basic) => {
      if (!e || e.cur <= 0) return;
      let m = mult;
      const a = { ...P, atk: P.atk * (1 + buff) };
      if (M) {
        if (M.rage) m *= 1 + (M.rage / 100) * (1 - hp / P.hp);
        if (M.soulAtk) m *= 1 + (souls * M.soulAtk) / 100;
        if (basic && M.firstCrit && !e.hit1) { e.hit1 = true; a.crit = 100; }
      }
      if (e.curse) m *= 1 + (e.curse * M.curse) / 100;
      const r = rollAttack(a, e, m * (skill ? 1 + P.skillDmg / 100 : 1), e.boss);
      e.cur -= r.dmg;
      if (basic) hp = Math.min(P.hp, hp + r.dmg * P.lifesteal / 100);
      if (basic && Math.random() * 100 < P.stun) e.stun = 1.2;
      if (basic && M && e.cur > 0) {
        if (M.curse) e.curse = Math.min(M.curseMax, (e.curse || 0) + 1);
        if (M.poison) { e.poison = Math.min(M.poisonMax, (e.poison || 0) + 1); e.poisonT = M.poisonDur; e.pdps = hitDamage(P.atk, e.def) * M.poison; }
        if (M.execute && !e.boss && e.cur < e.hp * M.execute) e.cur = 0;
      }
      if (e.cur <= 0 && !e.gone) { e.gone = true; if (M && M.soulHeal) { souls = Math.min(M.soulMax, souls + 1); hp = Math.min(P.hp, hp + P.hp * M.soulHeal); } }
    };
    while (alive().length) {
      t += dt;
      if (t > timeLimit) return { win: false, t, hpLeft: hp / P.hp };
      if (buffT > 0) { buffT -= dt; if (buffT <= 0) buff = 0; }
      if (M && M.shieldEvery) { shT += dt; if (shT >= M.shieldEvery) { shT = 0; shield = P.hp * M.shieldPct; } }
      atkT += dt;
      if (atkT >= interval) {
        atkT -= interval;
        atkN++;
        const tg = alive()[0];
        if (atkN % every === 0) {
          if (M) { const ult = M.ult; for (const e of ult.aoe ? alive() : [tg]) hit(e, ult.mult, false, true); if (ult.heal) hp = Math.min(P.hp, hp + P.hp * ult.heal); }
          else hit(tg, 2.5, false, true);
        } else {
          hit(tg, 1, false, true);
          if (M && M.multishot) hit(alive().find((e) => e !== tg), M.multishot, false, true);
        }
        if (Math.random() * 100 < P.combo && tg.cur > 0) hit(tg, 1, false, true);
      }
      for (let i = 0; i < skills.length; i++) {
        cds[i] -= dt * cdr;
        if (cds[i] <= 0) {
          const s = skills[i];
          cds[i] = s.cd;
          if (s.type === 'heal') { hp = Math.min(P.hp, hp + P.hp * s.heal * (1 + 0.05 * (s.lvl - 1))); if (s.buff) { buff = s.buff; buffT = 6; } }
          else if (s.type === 'shield') shield = P.hp * s.shield * s.lm;
          else {
            const tg = s.type === 'aoe' ? alive() : [alive()[0]];
            for (const e of tg) for (let k = 0; k < (s.hits || 1); k++) hit(e, s.mult * s.lm / (s.hits || 1), true);
          }
        }
      }
      for (let i = 0; i < pets.length; i++) {
        petT[i] -= dt;
        if (petT[i] <= 0) { petT[i] = 2.2; const tg = alive()[0]; if (tg) hit(tg, pets[i].mult * pets[i].lm * (1 + (P.kitDmg || 0) / 100), true); }
      }
      for (const e of alive()) {
        if (e.poison) { e.cur -= e.pdps * e.poison * dt; e.poisonT -= dt; if (e.poisonT <= 0) e.poison = 0; if (e.cur <= 0) { hit(e, 0, false, false); continue; } }
        if (e.stun > 0) { e.stun -= dt; continue; }
        e.t -= dt;
        if (e.t <= 0) {
          e.t = e.interval;
          if (Math.random() * 100 < P.dodge) continue;
          if (M && M.parry && Math.random() * 100 < M.parry) { hit(e, 1); continue; }
          let d = hitDamage(e.atk, P.def) * (0.92 + Math.random() * 0.16);
          if (shield > 0) { const a = Math.min(shield, d); shield -= a; d -= a; }
          hp -= d;
          if (Math.random() * 100 < P.counter) hit(e, 1);
          if (hp <= 0) return { win: false, t, hpLeft: 0 };
        }
      }
    }
    hp = Math.min(P.hp, hp + P.hp * 0.25);
    t += 1.2;
  }
  return { win: true, t, hpLeft: hp / P.hp };
}
