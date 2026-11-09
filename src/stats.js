// Calcul des statistiques du héros et de la puissance (pur, testable sous Node)
import {
  heroBase, SLOTS, SUBSTAT_KEYS, SUBSTATS, SKILLS, SKILL_PASSIVE_ATK, PETS, PET_EQUIP_ATK, PET_OWN_HP,
  SKINS, VIP_PERKS, vipLevel, RARITY_MULT, GEAR_BASE, STAT_GROWTH,
} from './config.js';

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p]));
export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

export function itemMain(item) {
  const slot = SLOTS.find((s) => s.id === item.slot);
  const v = GEAR_BASE * Math.pow(STAT_GROWTH, item.l - 1) * RARITY_MULT[item.r] * item.q;
  const out = { atk: 0, hp: 0, def: 0 };
  for (const k in slot.main) out[k] = slot.main[k] * v;
  return out;
}

// Puissance « partielle » d'un objet, pour comparer deux objets du même emplacement
export function itemPower(item) {
  if (!item) return 0;
  const m = itemMain(item);
  let p = m.atk * 8 + m.hp * 0.8 + m.def * 6;
  let subs = 0;
  for (const s of item.subs) subs += s.v / SUBSTATS[s.k].base;
  return p * (1 + subs * 0.035);
}

export function skillLevelMult(lvl) { return 1 + 0.22 * (lvl - 1); }
export function petLevelMult(lvl) { return 1 + 0.18 * (lvl - 1); }

export function computeStats(st) {
  const vip = vipLevel(st.iap.vip);
  const perks = VIP_PERKS[vip];
  const base = heroBase(st.hero.lvl);
  let atk = base.atk, hp = base.hp, def = base.def;
  const sub = Object.fromEntries(SUBSTAT_KEYS.map((k) => [k, 0]));
  sub.critDmg = 50; // +50% de base (x1.5)
  sub.crit = 5;

  for (const s of SLOTS) {
    const it = st.gear[s.id];
    if (!it) continue;
    const m = itemMain(it);
    atk += m.atk; hp += m.hp; def += m.def;
    for (const x of it.subs) sub[x.k] += x.v;
  }

  // Bonus en %
  let atkPct = 0, hpPct = 0, defPct = 0;
  atkPct += st.train.atk * 2;
  hpPct += st.train.hp * 2;
  defPct += st.train.def * 2;
  sub.crit += st.train.crit * 0.1;

  for (const id in st.skills.owned) {
    const sk = SKILL_BY_ID[id];
    if (sk) atkPct += SKILL_PASSIVE_ATK[sk.r] * (1 + 0.1 * (st.skills.owned[id].lvl - 1));
  }
  for (const id in st.pets.owned) {
    const p = PET_BY_ID[id];
    if (p) hpPct += PET_OWN_HP[p.r] * (1 + 0.1 * (st.pets.owned[id].lvl - 1));
  }
  const petSlots = perks.petSlots;
  for (let i = 0; i < petSlots; i++) {
    const id = st.pets.equipped[i];
    if (!id || !st.pets.owned[id]) continue;
    atkPct += PET_EQUIP_ATK[PET_BY_ID[id].r] * petLevelMult(st.pets.owned[id].lvl);
  }
  for (const id of st.skins.owned) {
    const sk = SKIN_BY_ID[id];
    if (!sk) continue;
    atkPct += sk.atk || 0; hpPct += sk.hp || 0;
    if (sk.crit) sub.crit += sk.crit;
    if (sk.critDmg) sub.critDmg += sk.critDmg;
    if (sk.dodge) sub.dodge += sk.dodge;
  }
  atkPct += perks.stat; hpPct += perks.stat;

  atk *= 1 + atkPct / 100;
  hp *= 1 + hpPct / 100;
  def *= 1 + defPct / 100;

  for (const k of SUBSTAT_KEYS) sub[k] = Math.min(sub[k], SUBSTATS[k].cap);

  const out = { atk, hp, def, ...sub, atkPct, hpPct, vip };
  out.power = powerOf(out);
  return out;
}

export function powerOf(s) {
  const core = s.atk * 8 + s.hp * 0.8 + s.def * 6;
  const sec = (s.crit + s.combo + s.counter + s.stun + s.lifesteal + s.dodge) / 100 * 0.9
    + (s.critDmg - 50) / 100 * 0.25 + s.atkSpd / 100 * 0.6 + (s.skillDmg + s.bossDmg) / 100 * 0.2;
  return core * (1 + sec);
}

// Stats d'un adversaire d'arène construit à partir d'une puissance cible
export function statsFromPower(power, template) {
  const t = template;
  const ratio = power / Math.max(1, t.power);
  return { ...t, atk: t.atk * ratio, hp: t.hp * ratio, def: t.def * ratio, power };
}
