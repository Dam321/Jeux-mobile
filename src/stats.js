// Calcul des statistiques du héros et de la puissance (pur, testable sous Node)
import {
  heroBase, SLOTS, SLOT_BY_ID, SUBSTAT_KEYS, SUBSTATS, SKILLS, SKILL_PASSIVE_ATK, VIP_PERKS, vipLevel, RARITY_MULT, GEAR_BASE, STAT_GROWTH, TIER_SUFFIX,
} from './config.js';
import {
  KITTEN_BY_ID, KITTEN_EQUIP_ATK, KITTEN_OWN_HP, KITTEN_BONUS_VAL, kittenLevelMult, COSTUMES as COSTUMES2, SET_BY_ID, RELIC_BY_ID, FORGE_BONUS,
} from './content.js';
import { classOf, specOf } from './classes.js';
import { guildFx } from './guild.js';
import { ALTAR_PCT } from './altar.js';
import { bestiaryTotal, BESTIARY_PCT } from './event.js';
import { ALL_BOSSES } from './content.js';
import { COSTUMES3, ARTIFACT_BY_ID, artifactBonus, artifactSlots, AURA_BY_ID, TITLE_BY_ID, FRAME_BY_ID } from './content3.js';
const COSTUMES = [...COSTUMES2, ...COSTUMES3];
const COSTUME_BY_ID = Object.fromEntries(COSTUMES.map((c) => [c.id, c]));

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export { KITTEN_BY_ID, COSTUME_BY_ID };

export function itemName(it) {
  if (it.relic) return RELIC_BY_ID[it.relic].name;
  const slot = SLOT_BY_ID[it.slot];
  const base = (slot.bases && slot.bases[it.base]) || slot.name;
  if (it.set) return `${base} — ${SET_BY_ID[it.set].name.replace('Panoplie ', '')}`;
  return `${base} ${TIER_SUFFIX[it.r]}`;
}

export function itemLevel(it, heroLvl) {
  return it.relic ? Math.max(it.l, heroLvl || 1) : it.l; // les reliques suivent le niveau du héros
}

export function itemMain(it, heroLvl) {
  const slot = SLOT_BY_ID[it.slot];
  const l = itemLevel(it, heroLvl);
  const v = GEAR_BASE * Math.pow(STAT_GROWTH, l - 1) * RARITY_MULT[it.r] * it.q * (1 + (it.upg || 0) * FORGE_BONUS) * (it.set ? 1.25 : 1);
  const out = { atk: 0, hp: 0, def: 0 };
  for (const k in slot.main) out[k] = slot.main[k] * v;
  return out;
}

// Puissance « partielle » d'un objet, pour comparer deux objets du même emplacement
export function itemPower(it, heroLvl) {
  if (!it) return 0;
  const m = itemMain(it, heroLvl);
  let p = m.atk * 8 + m.hp * 0.8 + m.def * 6;
  let subs = 0;
  for (const s of it.subs) subs += s.v / SUBSTATS[s.k].base;
  if (it.relic) subs += 12;
  if (it.set) subs += 4;
  return p * (1 + subs * 0.035);
}

export function skillLevelMult(lvl) { return 1 + 0.22 * (lvl - 1); }

export function setCounts(st) {
  const c = {};
  for (const s of SLOTS) { const it = st.gear[s.id]; if (it && it.set) c[it.set] = (c[it.set] || 0) + 1; }
  return c;
}

export function kittenStats(st, id) {
  const k = KITTEN_BY_ID[id];
  const o = st.kittens.owned[id];
  const lm = kittenLevelMult(o ? o.lvl : 1);
  return { k, lm, atkMult: [0.25, 0.35, 0.5, 0.7, 1.0, 1.5, 2.3, 3.5, 5.5][k.r] * lm, equipAtk: KITTEN_EQUIP_ATK[k.r] * lm, ownHp: KITTEN_OWN_HP[k.r] * (1 + 0.1 * ((o ? o.lvl : 1) - 1)), bonus: KITTEN_BONUS_VAL[k.r] * lm };
}

export function computeStats(st) {
  const vip = vipLevel(st.iap.vip);
  const perks = VIP_PERKS[vip];
  const base = heroBase(st.hero.lvl);
  let atk = base.atk, hp = base.hp, def = base.def;
  const sub = Object.fromEntries(SUBSTAT_KEYS.map((k) => [k, 0]));
  sub.critDmg = 50;
  sub.crit = 5;
  let goldPct = 0, kitDmg = 0;
  const perksOn = {};

  for (const s of SLOTS) {
    const it = st.gear[s.id];
    if (!it) continue;
    const m = itemMain(it, st.hero.lvl);
    atk += m.atk; hp += m.hp; def += m.def;
    for (const x of it.subs) sub[x.k] += x.v;
  }
  let atkPct = 0, hpPct = 0, defPct = 0;
  const addFx = (fx) => {
    for (const k in fx) {
      if (k === 'atk') atkPct += fx[k];
      else if (k === 'hp') hpPct += fx[k];
      else if (k === 'gold') goldPct += fx[k];
      else if (k === 'kitDmg') kitDmg += fx[k];
      else if (sub[k] != null) sub[k] += fx[k];
    }
  };
  // reliques
  for (const s of SLOTS) { const it = st.gear[s.id]; if (it && it.relic) { const R = RELIC_BY_ID[it.relic]; addFx(R.fx); if (R.perk) perksOn[R.perk] = true; } }
  // panoplies
  const sc = setCounts(st);
  const setBonus = [];
  for (const id in sc) {
    const S = SET_BY_ID[id];
    for (const n in S.bonus) if (sc[id] >= +n) { addFx(S.bonus[n]); setBonus.push({ id, n: +n }); }
  }
  // arbre de guilde (actif seulement en guilde)
  addFx(guildFx(st));
  // bestiaire : chaque palier de chasse atteint compte pour toujours
  const bt = bestiaryTotal(st, (k) => ALL_BOSSES.includes(k));
  atkPct += bt * BESTIARY_PCT; hpPct += bt * BESTIARY_PCT;
  // Autel de Bastet
  const al = (st.altar && st.altar.lvl) || 0;
  atkPct += al * ALTAR_PCT; hpPct += al * ALTAR_PCT;
  // classe et spécialisation
  const C = classOf(st), SP = specOf(st);
  for (const fx of [C && C.base, SP && SP.fx]) {
    if (!fx) continue;
    if (fx.def) defPct += fx.def;
    addFx(Object.fromEntries(Object.entries(fx).filter(([k]) => k !== 'def')));
  }
  atkPct += st.train.atk * 2;
  hpPct += st.train.hp * 2;
  defPct += st.train.def * 2;
  sub.crit += st.train.crit * 0.1;

  for (const id in st.skills.owned) {
    const sk = SKILL_BY_ID[id];
    if (sk) atkPct += SKILL_PASSIVE_ATK[sk.r] * (1 + 0.1 * (st.skills.owned[id].lvl - 1));
  }
  // chatons : PV possédés + ATQ et bonus spécial si équipés
  for (const id in st.kittens.owned) if (KITTEN_BY_ID[id]) hpPct += kittenStats(st, id).ownHp;
  for (let i = 0; i < perks.kittenSlots; i++) {
    const id = st.kittens.equipped[i];
    if (!id || !st.kittens.owned[id]) continue;
    const ks = kittenStats(st, id);
    atkPct += ks.equipAtk;
    const b = ks.k.bonus;
    if (b === 'gold') goldPct += ks.bonus * 2;
    else if (b === 'hp') hpPct += ks.bonus * 1.5;
    else if (b === 'luck') sub.luck += ks.bonus * 2;
    else if (b === 'critDmg' || b === 'skillDmg' || b === 'bossDmg') sub[b] += ks.bonus * 2;
    else if (sub[b] != null) sub[b] += ks.bonus * 0.5;
  }
  for (const id of st.costumes.owned) {
    const c = COSTUME_BY_ID[id];
    if (!c) continue;
    atkPct += c.atk || 0; hpPct += c.hp || 0;
    if (c.crit) sub.crit += c.crit;
    if (c.critDmg) sub.critDmg += c.critDmg;
    if (c.dodge) sub.dodge += c.dodge;
  }
  // artefacts équipés
  const aSlots = artifactSlots(vip);
  for (let i = 0; i < aSlots; i++) {
    const id = (st.artifacts && st.artifacts.equipped[i]) || null;
    const o = id && st.artifacts.owned[id];
    if (!o || o.stars < 0) continue;
    const A = ARTIFACT_BY_ID[id];
    addFx({ [A.stat]: artifactBonus(A, o.lvl, o.stars) });
  }
  // collection de cosmétiques (chaque pièce possédée compte)
  if (st.cos) {
    for (const id of st.cos.auras) { const a = AURA_BY_ID[id]; if (a) atkPct += a.atk; }
    for (const id of st.cos.titles) { const t = TITLE_BY_ID[id]; if (t) hpPct += t.hp; }
    for (const id of st.cos.frames) { const f = FRAME_BY_ID[id]; if (f) sub.luck += f.luck; }
  }
  // potions et boosts temporaires
  const now = Date.now(), B = st.boost || {};
  if (B.atkUntil > now) atkPct += 30;
  if (B.hpUntil > now) hpPct += 30;
  if (B.royalUntil > now) { atkPct += 60; hpPct += 60; }
  if (B.goldUntil > now) goldPct += 100;
  if (B.luckUntil > now) sub.luck += 100;
  atkPct += perks.stat; hpPct += perks.stat;
  sub.luck += perks.luck;

  atk *= 1 + atkPct / 100;
  hp *= 1 + hpPct / 100;
  def *= 1 + defPct / 100;
  for (const k of SUBSTAT_KEYS) sub[k] = Math.min(sub[k], SUBSTATS[k].cap);

  const out = { atk, hp, def, ...sub, atkPct, hpPct, goldPct, kitDmg, vip, perks: perksOn, setBonus, cls: C ? C.id : null, spec: SP ? SP.id : null };
  out.power = powerOf(out);
  return out;
}

export function powerOf(s) {
  const core = s.atk * 8 + s.hp * 0.8 + s.def * 6;
  const sec = (s.crit + s.combo + s.counter + s.stun + s.lifesteal + s.dodge) / 100 * 0.9
    + (s.critDmg - 50) / 100 * 0.25 + s.atkSpd / 100 * 0.6 + (s.skillDmg + s.bossDmg) / 100 * 0.2;
  return core * (1 + sec);
}

// Stats d'un adversaire construit à partir d'une puissance cible (proportions du joueur)
export function statsFromPower(power, template) {
  const ratio = power / Math.max(1, template.power);
  return { ...template, atk: template.atk * ratio, hp: template.hp * ratio, def: template.def * ratio, power };
}
export { COSTUMES };
