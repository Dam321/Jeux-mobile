// Contenu des panneaux (feuilles) de l'interface — v2
import { h, fmt, fmtPct, fmtTime, fmtEuro } from '../util.js';
import { icon } from './icons.js';
import {
  RARITIES, SUBSTATS, TRAININGS, trainingCost, SKILLS, SKILL_PASSIVE_ATK, SKILL_RARITY_ODDS, SKILL_PITY_LEG, SKILL_PITY_DIV,
  dupNeed, VIP_PERKS, VIP_THRESHOLDS, VIP_TEXT, PRODUCTS, FUND_TIERS, PASS_TIERS, PASS_XP_PER_TIER, DAILY_QUESTS, DAILY_CHESTS,
  LOGIN_CALENDAR, ACHIEVEMENTS, DUNGEONS, dungeonReward, towerStage, ARENA_SHOP, arenaDailyGems, AD_LIMIT, AD_REWARDS,
  FIRST_RECHARGE, DUNGEON_FREE_KEYS, SLOTS, divisionOf, DIVISIONS, LAIR_FREE, lairBuyCost,
} from '../config.js';
import {
  KITTENS, KITTEN_ODDS, KITTEN_PITY_LEG, KITTEN_PITY_MYTH, ELEMENTS, KBONUS, LOOK_UNLOCK, PATTERN_COLORS, HETERO_COST,
  SETS, artisanXpNext, craftGold, FORGE_MAX, forgeCost, RELICS, RELIC_CHEST, RELIC_CONSOLATION, RESOURCES, RES_BY_ID,
  MARKET_LOTS, MARKET_TAX, MARKET_QUICK_SELL, TERRITORIES, CLANS, WAR_SHOP, WAR_ENERGY,
} from '../content.js';
import { SKILL_BY_ID, KITTEN_BY_ID, skillLevelMult, kittenStats, itemPower, itemName, setCounts, COSTUMES } from '../stats.js';
import { passTier, craftCheck, forgeChance, milkNeeded, lookUnlocked, lookPrice, bannerKitten } from '../economy.js';
import {
  ARTIFACTS, ARTIFACT_BY_ID, ARTIFACT_MAX_STARS, artifactFragsNeed, artifactLevelCost, artifactBonus, artifactSlots, ARTIFACT_CHEST,
  AURAS, TITLES, FRAMES, STYLE_SHOP, POTIONS, TRANSMUTE_RATIO, TOWER_SHOP, TOWER_MILESTONES, towerFloorInfo, towerMilestone, towerFloorReward, LOYALTY, KITTEN_ATTACKS,
} from '../content3.js';
import { weekKey } from '../state.js';
import { unitPrice, lotPrice, maxListings, gemSellRate, gemBuyRate, gemBuyLimit } from '../market.js';
import { CLAN_BY_ID, defenderPower, defenderName, defenderLoadout, ownedTerritories, tributeAvailable, warBuyCost, myRank, botLoadout, towerBoard, towerRankReward, powerForStage, wbBoard, wbRankReward } from '../pvp.js';
import { CLASS_BY_ID } from '../classes.js';
import { FURS, PATTERNS, EYES, EYE_STYLES, EARS, TAILS, catPortraitURL } from '../gfx/cat.js';
import { itemIconURL } from '../gfx/gear.js';
import { monsterPortrait } from '../gfx/bestiary.js';
import { resIcon, slotName } from './ui.js';
import { classPanel } from './classui.js';
import { guildPanel } from './guildui.js';
import { eventPanel, bestiaryPanel, altarPanel } from './eventui.js';
import { adaptBase } from '../classes.js';

const rr = (r) => ({ '--rc': RARITIES[r].color, '--rd': RARITIES[r].dark });
const chipsOf = (ui, g, rewards) => h('div.rewards.sm', null, g.previewRewards(rewards).map((r) => ui.rewardChip(r)));
const costBtn = (label, res, amount, fn, cls = 'gold', disabled) => h('button.btn', { cls, disabled, onclick: fn }, h('span', null, label), h('small', { html: icon(res) + ' ' + fmt(amount) }));
const pct = (v) => (v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(1)) + '%';
function spark(hist) {
  if (!hist || hist.length < 2) return null;
  const min = Math.min(...hist), max = Math.max(...hist), span = max - min || 1;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * 60},${18 - ((v - min) / span) * 16}`).join(' ');
  const up = hist[hist.length - 1] >= hist[0];
  return h('span.spark', { html: `<svg viewBox="0 0 60 20" width="60" height="20"><polyline points="${pts}" fill="none" stroke="${up ? '#6dff9e' : '#ff8590'}" stroke-width="2" stroke-linejoin="round"/></svg>` });
}

// ====================================================================== HÉROS
const hero = {
  title: 'Héros',
  tabs: [['gear', 'Équipement'], ['class', 'Classe'], ['look', 'Apparence'], ['style', 'Style'], ['artifacts', 'Artefacts'], ['skills', 'Pouvoirs'], ['train', 'Entraînement'], ['stats', 'Stats']],
  tabDot: (g, id) => (id === 'class' ? g.classDot() : id === 'train' ? g.trainAffordable() : id === 'skills' ? g.st.res.feathers >= 1 || g.anyLevelUp('skills') : false),
  render(ui, g, tab) {
    const st = g.st, S = g.stats;
    if (tab === 'gear') {
      const sc = setCounts(st);
      return h('div.col', null,
        h('div.hero-card', null,
          h('img.hero-img', { src: g.fullURL(), alt: '' }),
          h('div.grow', null, h('b.big', null, 'Minou'), h('div.muted', null, `Niveau ${st.hero.lvl}`), h('div.power.lg', { html: icon('power') + fmt(S.power) }),
            Object.keys(sc).map((id) => h('div.small', { style: { color: SETS.find((x) => x.id === id).color } }, `${SETS.find((x) => x.id === id).name} : ${sc[id]} pièce(s)`))),
        ),
        h('div.slot-list', null, SLOTS.map((s) => {
          const it = st.gear[s.id];
          return h('button.slot-row', { onclick: () => it && ui.showItem(it) },
            it ? ui.itemIcon(it) : h('div.item-ic.empty', null, h('small', null, s.name)),
            h('div.grow', null, h('b', null, it ? itemName(it) : s.name), h('div.small.muted', null, it ? `${RARITIES[it.r].name}${it.upg ? ' · +' + it.upg : ''}${it.set ? ' · panoplie' : ''}${it.relic ? ' · RELIQUE' : ''}` : 'Vide — ouvrez des cartons')),
            it ? h('span.ipow', { html: icon('power') + fmt(itemPower(it, st.hero.lvl)) }) : null,
          );
        })),
        h('h4', null, `Sac (${st.bag.length}/${VIP_PERKS[S.vip].bag})`),
        st.bag.length ? h('div.bag-grid', null, st.bag.map((it) => h('button.bag-it', { onclick: () => ui.showItem(it) }, ui.itemIcon(it)))) : h('p.muted.small', null, 'Les objets fabriqués, forgés et les reliques non équipés vont ici.'),
        h('div.toggle-row', null, h('button.toggle', { cls: st.box.autoBreak ? 'on' : '', onclick: () => g.setAutoBreak(!st.box.autoBreak) }, h('span', null, 'Briser les objets inutiles en runes (au lieu de l\'or)'), h('i'))),
      );
    }
    if (tab === 'class') return classPanel(ui, g);
    if (tab === 'look') return lookPanel(ui, g);
    if (tab === 'skills') return skillsPanel(ui, g);
    if (tab === 'artifacts') return artifactsPanel(ui, g);
    if (tab === 'style') {
      const C = st.cos;
      return h('div.col', null,
        h('p.small.muted', null, 'Chaque élément de style possédé donne un bonus permanent : la collection compte !'),
        h('h4', null, `Auras (${C.auras.length}/${AURAS.length}) · +ATQ`),
        h('div.grid3', null, AURAS.map((a) => {
          const own = C.auras.includes(a.id);
          return h('button.style-card', { cls: 'r' + a.r + (own ? '' : ' locked') + (C.aura === a.id ? ' on' : ''), style: rr(a.r), onclick: () => (own ? g.setAura(a.id) : ui.open('shop', 'style')) },
            h('span.aura-prev', { style: { '--a1': a.colors[0], '--a2': a.colors[1] || a.colors[0] } }), h('b', null, a.name), h('small', null, `+${a.atk}% ATQ`));
        })),
        h('h4', null, `Titres (${C.titles.length}/${TITLES.length}) · +PV`),
        h('div.title-list', null, TITLES.map((t) => {
          const own = C.titles.includes(t.id);
          return h('button.title-row', { cls: (own ? '' : 'locked') + (C.title === t.id ? ' on' : ''), onclick: () => own && g.setTitle(t.id) }, h('b.title-tag', { cls: 'r' + t.r }, t.name), h('small.muted', null, own ? `+${t.hp}% PV` : t.src));
        })),
        h('h4', null, `Cadres (${C.frames.length}/${FRAMES.length}) · +butin`),
        h('div.grid3', null, FRAMES.map((f) => {
          const own = C.frames.includes(f.id);
          return h('button.style-card', { cls: 'r' + f.r + (own ? '' : ' locked') + (C.frame === f.id ? ' on' : ''), style: rr(f.r), onclick: () => own && g.setFrame(f.id) },
            h('span.frame-prev', { dataset: { frame: f.id } }, h('img', { src: g.portrait(), alt: '' })), h('b', null, f.name), h('small', null, own ? `+${f.luck}% butin` : f.src));
        })),
        h('h4', null, `Costumes (${st.costumes.owned.length}/${COSTUMES.length})`),
        costumesBlock(ui, g),
      );
    }
    if (tab === 'costumes') {
      return h('div.col', null,
        h('button.toggle', { cls: st.costumes.show ? 'on' : '', onclick: () => g.toggleCostumeShow() }, h('span', null, 'Afficher le costume (sinon : votre apparence + équipement)'), h('i')),
        h('div.grid2', null, COSTUMES.map((c) => {
          const owned = st.costumes.owned.includes(c.id);
          const cur = st.costumes.current === c.id;
          const bon = [c.atk ? `+${c.atk}% ATQ` : '', c.hp ? `+${c.hp}% PV` : '', c.crit ? `+${c.crit}% Crit.` : '', c.critDmg ? `+${c.critDmg}% Dég. crit.` : '', c.dodge ? `+${c.dodge}% Esquive` : ''].filter(Boolean).join(' · ') || 'Classique';
          let btn;
          if (cur) btn = h('button.btn.sm.gray', { disabled: true }, 'Porté');
          else if (owned) btn = h('button.btn.sm.green', { onclick: () => g.setCostume(c.id) }, 'Porter');
          else btn = h('button.btn.sm.purple', { onclick: () => g.costumeSource(c.id) }, 'Obtenir');
          return h('div.skin-card', { cls: 'r' + c.r + (owned ? '' : ' locked'), style: rr(c.r) },
            ui.costumeImg(c.id), h('b', null, c.name), h('small.bonus', null, bon),
            h('small.muted', null, owned ? 'Bonus actif (possédé)' : c.src), btn);
        })),
      );
    }
    if (tab === 'train') {
      return h('div.col', null,
        h('div.res-banner', { html: icon('gold') + ' ' + fmt(st.res.gold) + ' or' }),
        TRAININGS.map((t) => {
          const lvl = st.train[t.id];
          const cost = trainingCost(t.id, lvl);
          const maxed = t.max && lvl >= t.max;
          return h('div.list-row', null,
            h('div.tr-ic', { cls: t.id }, t.stat),
            h('div.grow', null, h('b', null, t.name), h('div.muted.small', null, `Niv. ${lvl} · +${fmt(t.per * lvl)}% ${t.stat}`)),
            maxed ? h('b.muted', null, 'MAX') : h('div.btn-pair', null, costBtn('+1', 'gold', cost, () => g.trainN(t.id, 1), st.res.gold >= cost ? 'gold' : 'gray'), h('button.btn.sm.blue', { onclick: () => g.trainN(t.id, 25) }, 'x25')),
          );
        }),
      );
    }
    const rows = [['ATQ', fmt(S.atk)], ['PV', fmt(S.hp)], ['DÉF', fmt(S.def)], ...Object.keys(SUBSTATS).map((k) => [SUBSTATS[k].name, fmtPct(S[k])]), ['Or gagné', '+' + fmt(S.goldPct) + '%']];
    return h('div.col', null,
      h('div.stat-grid', null, rows.map(([k, v]) => h('div.srow', null, h('span', null, k), h('b', null, v)))),
      h('h4', null, 'Bonus'),
      h('div.stat-grid', null,
        h('div.srow', null, h('span', null, 'ATQ totale'), h('b.good', null, '+' + fmt(S.atkPct) + '%')),
        h('div.srow', null, h('span', null, 'PV totaux'), h('b.good', null, '+' + fmt(S.hpPct) + '%')),
        h('div.srow', null, h('span', null, 'Bonus VIP ' + S.vip), h('b.vipc', null, '+' + VIP_PERKS[S.vip].stat + '%')),
        h('div.srow', null, h('span', null, 'Bonus de panoplies'), h('b', null, S.setBonus.length)),
      ),
    );
  },
};

function lookPanel(ui, g) {
  const st = g.st, L = st.look;
  const sec = (title, cat, map, render) => h('div.look-sec', null, h('h4', null, title), h('div.look-opts', null, Object.keys(map).map((id) => {
    const owned = lookUnlocked(st, cat, id);
    const price = lookPrice(cat, id);
    const on = L[cat] === id;
    return h('button.look-opt', { cls: (on ? 'on ' : '') + (owned ? '' : 'locked'), onclick: () => g.pickLook(cat, id) },
      render(id), h('small', null, typeof map[id] === 'string' ? map[id] : map[id].name),
      !owned ? h('i.lprice', { html: typeof price === 'number' ? icon('gems') + price : price === 'pack' ? 'Pack' : price.toUpperCase() }) : null);
  })));
  return h('div.col', null,
    h('div.look-preview', null,
      h('img.look-big', { src: g.fullURL(), alt: '' }),
      h('div.look-side', null,
        h('button.btn.purple', { onclick: () => g.randomLook() }, 'Aléatoire'),
        st.costumes.show ? h('p.small.muted', null, 'Un costume est affiché par-dessus. Désactivez-le dans l\'onglet Costumes.') : h('p.small.muted', null, 'L\'équipement porté s\'affiche sur votre chat.'),
      ),
    ),
    sec('Pelage', 'fur', FURS, (id) => h('i.swatch', { style: { background: FURS[id].c } })),
    sec('Motif', 'pattern', PATTERNS, (id) => ui.lookImg({ ...L, pattern: id }, 56, 'mini')),
    h('div.look-sec', null, h('h4', null, 'Couleur du motif'), h('div.look-opts', null, PATTERN_COLORS.map((c) => h('button.look-opt.sw', { cls: L.pcolor === c ? 'on' : '', onclick: () => g.pickLook('pcolor', c) }, h('i.swatch', { style: { background: c } }))))),
    sec('Yeux', 'eye', EYES, (id) => h('i.swatch.eye', { style: { background: EYES[id].c } })),
    h('button.toggle', { cls: L.eye2 ? 'on' : '', onclick: () => g.toggleHetero() }, h('span', { html: `Yeux vairons (deux couleurs) ${st.unlocks.includes('eye2:on') ? '' : '· ' + icon('gems') + HETERO_COST}` }), h('i')),
    sec('Regard', 'eyeStyle', EYE_STYLES, (id) => ui.lookImg({ ...L, eyeStyle: id }, 56, 'mini')),
    sec('Oreilles', 'ears', EARS, (id) => ui.lookImg({ ...L, ears: id }, 56, 'mini')),
    sec('Queue', 'tail', TAILS, (id) => h('b.tailtxt', null, { normal: '〰', fluffy: '☁', short: '•' }[id])),
  );
}

function skillsPanel(ui, g) {
  const st = g.st, data = st.skills;
  const slots = VIP_PERKS[g.stats.vip].skillSlots;
  const pic = (x) => h('span.sk-ic', { html: icon('sk_' + x.id) });
  const detail = (x) => {
    const o = data.owned[x.id];
    const lvl = o ? o.lvl : 1;
    const lines = [];
    if (x.mult) lines.push(`Dégâts : ${fmt(x.mult * skillLevelMult(lvl) * 100)}% ATQ${x.hits ? ` (${x.hits} coups)` : ''}`);
    if (x.heal) lines.push(`Soin : ${Math.round(x.heal * 100)}% PV`);
    if (x.shield) lines.push(`Bouclier : ${Math.round(x.shield * skillLevelMult(lvl) * 100)}% PV`);
    lines.push(`Recharge : ${x.cd} s`);
    lines.push(`Bonus possédé : +${fmt(SKILL_PASSIVE_ATK[x.r] * (1 + 0.1 * (lvl - 1)))}% ATQ`);
    const body = h('div.detail', { style: rr(x.r) }, h('div.detail-top', { cls: 'r' + x.r }, pic(x), h('div', null, h('b', null, x.name), h('span.irar', null, RARITIES[x.r].name), h('div.muted', null, o ? `Niveau ${o.lvl}` : 'Non possédé'))),
      h('p', null, x.desc), h('ul.lines', null, lines.map((l) => h('li', null, l))),
      o ? h('div.copies', null, h('span', null, `Copies ${o.copies}/${dupNeed(o.lvl)}`), h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, o.copies / dupNeed(o.lvl))})` } }))) : null);
    const btns = [];
    if (o) {
      btns.push({ label: 'Améliorer', cls: o.copies >= dupNeed(o.lvl) ? 'gold' : 'gray', disabled: o.copies < dupNeed(o.lvl), fn: () => { g.levelUpSkill(x.id); } });
      const idx = data.equipped.indexOf(x.id);
      if (idx >= 0 && idx < slots) btns.push({ label: 'Retirer', cls: 'red', fn: () => g.unequipSkill(idx) });
      else btns.push({ label: 'Équiper', cls: 'green', fn: () => g.equipSkill(x.id) });
    }
    ui.modal({ title: 'Pouvoir', body, buttons: btns, cls: 'r' + x.r });
  };
  const have = st.res.feathers;
  const sumBtn = (n, gems) => h('button.btn.summon', { cls: have >= n ? 'green' : 'purple', onclick: () => g.summonSkills(n) }, h('span', null, 'x' + n), h('small', { html: have >= n ? icon('feathers') + ' ' + n : icon('gems') + ' ' + fmt(gems) }));
  return h('div.col', null,
    h('div.eq-row', null, Array.from({ length: 4 }, (_, i) => {
      if (i >= slots) return h('div.eq-slot.locked', { html: icon('lock') + '<small>VIP 6</small>', onclick: () => ui.open('shop', 'vip') });
      const id = data.equipped[i];
      if (!id) return h('div.eq-slot.empty', null, '+');
      const x = SKILL_BY_ID[id];
      return h('button.eq-slot', { cls: 'r' + x.r, style: rr(x.r), onclick: () => detail(x) }, pic(x), h('b', null, 'Nv ' + data.owned[id].lvl));
    })),
    h('div.summon-card', null,
      h('div.summon-top', null, h('b', null, 'Autel des Plumes'), h('span.have', { html: icon('feathers') + ' ' + fmt(have) })),
      h('div.summon-btns', null, !st.daily.summonFree ? h('button.btn.summon.gold', { onclick: () => g.summonSkills(1, true) }, h('span', null, 'Gratuit'), h('small', null, '1 / jour')) : null, sumBtn(1, 100), sumBtn(10, 900), sumBtn(35, 3000)),
      h('div.pity', null, `Légendaire garanti dans ${SKILL_PITY_LEG - data.pityLeg} · Divin garanti dans ${SKILL_PITY_DIV - data.pityDiv}`),
      h('button.link', { onclick: () => ui.modal({ title: 'Probabilités', body: h('div.odds', null, SKILL_RARITY_ODDS.map((p, r) => (p ? h('div.orow', { style: { '--rc': RARITIES[r].color } }, h('i'), h('span', null, RARITIES[r].name), h('b', null, p + '%')) : null))) }) }, 'Voir les probabilités'),
    ),
    h('div.coll-grid', null, SKILLS.map((x) => {
      const o = data.owned[x.id];
      const need = o ? dupNeed(o.lvl) : 1;
      return h('button.coll', { cls: 'r' + x.r + (o ? '' : ' locked') + (o && o.copies >= need ? ' can' : ''), style: rr(x.r), onclick: () => detail(x) },
        pic(x), h('b', null, x.name),
        o ? h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, o.copies / need)})` } }), h('small', null, `Nv ${o.lvl} · ${o.copies}/${need}`)) : h('small.muted', null, RARITIES[x.r].name));
    })),
  );
}

function costumesBlock(ui, g) {
  const st = g.st;
  return h('div.col', null,
    h('button.toggle', { cls: st.costumes.show ? 'on' : '', onclick: () => g.toggleCostumeShow() }, h('span', null, 'Afficher le costume porté'), h('i')),
    h('div.grid2', null, COSTUMES.map((c) => {
      const owned = st.costumes.owned.includes(c.id);
      const cur = st.costumes.current === c.id;
      const bon = [c.atk ? `+${c.atk}% ATQ` : '', c.hp ? `+${c.hp}% PV` : '', c.crit ? `+${c.crit}% Crit.` : '', c.critDmg ? `+${c.critDmg}% Dég. crit.` : '', c.dodge ? `+${c.dodge}% Esquive` : ''].filter(Boolean).join(' · ') || 'Classique';
      const btn = cur ? h('button.btn.sm.gray', { disabled: true }, 'Porté') : owned ? h('button.btn.sm.green', { onclick: () => g.setCostume(c.id) }, 'Porter') : h('button.btn.sm.purple', { onclick: () => g.costumeSource(c.id) }, 'Obtenir');
      return h('div.skin-card', { cls: 'r' + c.r + (owned ? '' : ' locked'), style: rr(c.r) }, ui.costumeImg(c.id), h('b', null, c.name), h('small.bonus', null, bon), h('small.muted', null, owned ? 'Bonus actif' : c.src), btn);
    })),
  );
}

function artifactsPanel(ui, g) {
  const st = g.st, A = st.artifacts;
  const slots = artifactSlots(g.stats.vip);
  const detail = (a) => {
    const o = A.owned[a.id] || { lvl: 1, stars: -1, frags: 0 };
    const unlocked = o.stars >= 0;
    const cost = artifactLevelCost(a, o.lvl);
    const statName = a.stat === 'atk' ? 'ATQ' : a.stat === 'hp' ? 'PV' : a.stat === 'gold' ? 'Or gagné' : a.stat === 'kitDmg' ? 'Dégâts des chatons' : (SUBSTATS[a.stat] || {}).name || a.stat;
    const body = h('div.detail', { style: rr(a.r) },
      h('div.detail-top', { cls: 'r' + a.r }, h('span.sk-ic', { html: ui.artIcon(a) }), h('div', null, h('b', null, a.name), h('span.irar', null, RARITIES[a.r].name), h('div.muted', null, unlocked ? `Niveau ${o.lvl} · ${'★'.repeat(o.stars)}${'☆'.repeat(ARTIFACT_MAX_STARS - o.stars)}` : 'Pas encore débloqué'))),
      h('ul.lines', null, h('li', null, `${statName} +${fmt(artifactBonus(a, Math.max(1, o.lvl), Math.max(0, o.stars)))}%`), h('li', null, `+${a.per}% par niveau, +25 % par étoile — niveaux illimités`)),
      h('div.copies', null, h('span', null, `Fragments ${o.frags}/${artifactFragsNeed(o.stars)}`), h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, o.frags / artifactFragsNeed(o.stars))})` } }))));
    const btns = [];
    if (unlocked) {
      btns.push({ label: 'Niveau +1', sub: `${resIcon('artDust')}${fmt(cost.dust)} · ${icon('gold')}${fmt(cost.gold)}`, cls: 'gold', fn: () => { g.artifactLevel(a.id, 1); } });
      btns.push({ label: 'x10', cls: 'blue', fn: () => { g.artifactLevel(a.id, 10); } });
      if (o.stars < ARTIFACT_MAX_STARS) btns.push({ label: 'Étoile', cls: o.frags >= artifactFragsNeed(o.stars) ? 'purple' : 'gray', disabled: o.frags < artifactFragsNeed(o.stars), fn: () => { g.artifactStar(a.id); } });
      const idx = A.equipped.indexOf(a.id);
      btns.push(idx >= 0 && idx < slots ? { label: 'Retirer', cls: 'red', fn: () => g.unequipArtifact(idx) } : { label: 'Équiper', cls: 'green', fn: () => g.equipArtifact(a.id) });
    }
    ui.modal({ title: 'Artefact', body, buttons: btns, cls: 'r' + a.r });
  };
  return h('div.col', null,
    h('div.eq-row', null, Array.from({ length: 6 }, (_, i) => {
      if (i >= slots) return h('div.eq-slot.locked', { html: icon('lock') + `<small>VIP ${i === 4 ? 6 : 11}</small>`, onclick: () => ui.open('shop', 'vip') });
      const id = A.equipped[i];
      if (!id) return h('div.eq-slot.empty', null, '+');
      const a = ARTIFACT_BY_ID[id];
      return h('button.eq-slot', { cls: 'r' + a.r, style: rr(a.r), onclick: () => detail(a) }, h('span.sk-ic', { html: ui.artIcon(a) }), h('b', null, 'Nv ' + A.owned[id].lvl));
    })),
    h('div.res-banner', { html: `${resIcon('artDust')} ${fmt(st.mats.artDust || 0)} poussière · ${icon('gold')} ${fmt(st.res.gold)}` }),
    h('button.btn.purple.wide', { onclick: () => ui.open('shop', 'artifacts') }, h('span', null, 'Coffre d\'artefacts'), h('small', null, 'Fragments : boss, Tour des Défis, coffres, boutiques')),
    h('div.coll-grid', null, ARTIFACTS.map((a) => {
      const o = A.owned[a.id];
      const un = o && o.stars >= 0;
      return h('button.coll', { cls: 'r' + a.r + (un ? '' : ' locked'), style: rr(a.r), onclick: () => detail(a) }, h('span.sk-ic', { html: ui.artIcon(a) }), h('b', null, a.name),
        un ? h('small', null, `Nv ${o.lvl} · ★${o.stars}`) : h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, (o ? o.frags : 0) / 10)})` } }), h('small', null, `${o ? o.frags : 0}/10`)));
    })),
  );
}

// ligne de classement (Tour, Boss mondial)
function rankRow(r, value) {
  const C = r.cls && CLASS_BY_ID[r.cls];
  return h('div.rank-row', { cls: (r.me ? 'me ' : '') + (r.rank <= 3 ? 'top' + r.rank : '') },
    h('b.rk', null, r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank),
    h('i.rk-cls', { style: { background: C ? C.color : '#5e45ad' } }),
    h('span.grow', null, r.name, C ? h('small.muted', null, ' · ' + C.role) : null),
    h('b.rk-floor', null, value));
}
// classement de la Tour (modale)
function towerRankModal(ui, g) {
  const st = g.st;
  const board = towerBoard(st);
  const me = board.find((r) => r.me);
  const row = (r) => rankRow(r, 'Étage ' + r.floor);
  const top = board.slice(0, 50);
  const body = h('div.col', null,
    h('div.rank-me', null, h('b', null, `Vous : ${me.rank}e`), h('span', null, `record étage ${st.tower.best}`)),
    h('div.milestone', null, h('b', null, 'Récompense de la semaine (selon votre rang)'), chipsOf(ui, g, towerRankReward(me.rank)),
      h('button.btn', { cls: g.towerRankClaimable() ? 'gold' : 'gray', disabled: !g.towerRankClaimable(), onclick: () => { g.claimTowerRank(); close(); } }, g.towerRankClaimable() ? 'Récupérer' : st.tower.best > 0 ? 'Déjà récupérée cette semaine' : 'Conquérez un étage')),
    h('p.small.muted', null, 'Les autres joueurs grimpent aussi chaque jour. N°1 : titre exclusif « Maître de la Tour ».'),
    h('div.rank-list', null, top.map(row), me.rank > 50 ? [h('div.rank-gap', null, '…'), row(me)] : null),
  );
  const close = ui.modal({ title: 'Classement de la Tour', body });
}

// ====================================================================== CHATONS
const kittens = {
  title: 'Chatons',
  render(ui, g) {
    const st = g.st, data = st.kittens;
    const slots = VIP_PERKS[g.stats.vip].kittenSlots;
    const detail = (k) => {
      const o = data.owned[k.id];
      const ks = kittenStats(st, k.id);
      const E = ELEMENTS[k.el];
      const body = h('div.detail', { style: rr(k.r) },
        h('div.detail-top', { cls: 'r' + k.r }, ui.kittenImg(k.id), h('div', null, h('b', null, k.name), h('span.irar', null, RARITIES[k.r].name), h('div', { style: { color: E.color } }, 'Élément ' + E.name), h('div.muted', null, o ? `Niveau ${o.lvl}` : 'Pas encore trouvé'))),
        h('ul.lines', null,
          h('li', null, `Attaque « ${(KITTEN_ATTACKS[k.id] || {}).name} » : ${fmt(ks.atkMult * 100)}% ATQ toutes les 2,2 s${k.r >= 5 ? ' + version ULTIME' : ''}`),
          h('li', null, `Si équipé : +${fmt(ks.equipAtk)}% ATQ et ${KBONUS[k.bonus].name} +${fmt(ks.bonus * (['gold', 'luck', 'critDmg', 'skillDmg', 'bossDmg'].includes(k.bonus) ? 2 : k.bonus === 'hp' ? 1.5 : 0.5))}%`),
          h('li', null, `Possédé : +${fmt(ks.ownHp)}% PV`)),
        o ? h('div.copies', null, h('span', null, `Copies ${o.copies}/${dupNeed(o.lvl)}`), h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, o.copies / dupNeed(o.lvl))})` } }))) : null);
      const btns = [];
      if (o) {
        const need = milkNeeded(o);
        btns.push(o.copies >= dupNeed(o.lvl) ? { label: 'Améliorer', cls: 'gold', fn: () => { g.levelUpKitten(k.id, false); } }
          : { label: 'Lait doré', sub: `${icon('milk')} ${need} (${st.res.milk})`, cls: st.res.milk >= need ? 'gold' : 'gray', disabled: st.res.milk < need, fn: () => { g.levelUpKitten(k.id, true); } });
        const idx = data.equipped.indexOf(k.id);
        if (idx >= 0 && idx < slots) btns.push({ label: 'Retirer', cls: 'red', fn: () => g.unequipKitten(idx) });
        else btns.push({ label: 'Équiper', cls: 'green', fn: () => g.equipKitten(k.id) });
      }
      ui.modal({ title: 'Chaton', body, buttons: btns, cls: 'r' + k.r });
    };
    const have = st.res.eggs;
    const sumBtn = (n, gems) => h('button.btn.summon', { cls: have >= n ? 'green' : 'purple', onclick: () => g.summonKittens(n) }, h('span', null, 'x' + n), h('small', { html: have >= n ? icon('eggs') + ' ' + n : icon('gems') + ' ' + fmt(gems) }));
    const found = KITTENS.filter((k) => data.owned[k.id]).length;
    return h('div.col', null,
      h('div.eq-row', null, Array.from({ length: 5 }, (_, i) => {
        if (i >= slots) return h('div.eq-slot.locked', { html: icon('lock') + `<small>VIP ${i === 3 ? 4 : 9}</small>`, onclick: () => ui.open('shop', 'vip') });
        const id = data.equipped[i];
        if (!id) return h('div.eq-slot.empty', null, '+');
        const k = KITTEN_BY_ID[id];
        return h('button.eq-slot', { cls: 'r' + k.r, style: rr(k.r), onclick: () => detail(k) }, ui.kittenImg(id), h('b', null, 'Nv ' + data.owned[id].lvl));
      })),
      (() => { const fid = bannerKitten(weekKey()); const fk = KITTEN_BY_ID[fid]; return h('div.banner-card', { style: rr(fk.r) }, ui.kittenImg(fid), h('div.grow', null, h('small', null, 'CHATON VEDETTE DE LA SEMAINE'), h('b', null, fk.name), h('span', null, `${RARITIES[fk.r].name} · « ${KITTEN_ATTACKS[fid].name} » · 50 % des tirages ${RARITIES[fk.r].name}`))); })(),
      h('div.summon-card.pets', null,
        h('div.summon-top', null, h('b', null, 'Panier des Chatons'), h('span.have', { html: icon('eggs') + ' ' + fmt(have) + ' · ' + icon('milk') + ' ' + st.res.milk })),
        h('div.summon-btns', null, sumBtn(1, 80), sumBtn(10, 700), sumBtn(35, 2400)),
        h('div.pity', null, `Légendaire garanti dans ${KITTEN_PITY_LEG - data.pityLeg} · Mythique garanti dans ${KITTEN_PITY_MYTH - data.pityMyth}`),
        h('button.link', { onclick: () => ui.modal({ title: 'Probabilités du Panier', body: h('div.odds', null, KITTEN_ODDS.map((p, r) => h('div.orow', { style: { '--rc': RARITIES[r].color } }, h('i'), h('span', null, RARITIES[r].name), h('b', null, pct(p)))), h('p.muted.small', null, 'Les chatons sauvages trouvés en combat suivent les mêmes probabilités, sans garantie.')) }) }, 'Voir les probabilités'),
      ),
      h('p.small.muted.center', null, 'Des chatons sauvages peuvent aussi vous rejoindre après une étape ou un boss.'),
      h('h4', null, `Chatterie ${found}/${KITTENS.length}`),
      h('div.coll-grid.k4', null, KITTENS.map((k) => {
        const o = data.owned[k.id];
        const seen = data.seen.includes(k.id);
        const need = o ? dupNeed(o.lvl) : 1;
        return h('button.coll', { cls: 'r' + k.r + (o ? '' : ' locked') + (o && o.copies >= need ? ' can' : ''), style: rr(k.r), onclick: () => detail(k) },
          ui.kittenImg(k.id, seen ? '' : 'silhouette'),
          h('b', null, seen ? k.name : '???'),
          h('small', { style: { color: ELEMENTS[k.el].color } }, ELEMENTS[k.el].name),
          o ? h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, o.copies / need)})` } }), h('small', null, `Nv ${o.lvl}`)) : h('small.muted', null, RARITIES[k.r].name));
      })),
    );
  },
};

// ====================================================================== ATELIER (craft, forgemagie, ressources)
const atelier = {
  title: 'Atelier',
  tabs: [['sets', 'Panoplies'], ['forge', 'Forgemagie'], ['alchemy', 'Alchimie'], ['res', 'Ressources']],
  render(ui, g, tab) {
    const st = g.st;
    if (tab === 'sets') {
      return h('div.col', null,
        h('div.artisan', null, h('b', null, `Artisan niveau ${st.artisan.lvl}`), h('div.bar.wide', null, h('i', { style: { transform: `scaleX(${Math.min(1, st.artisan.xp / artisanXpNext(st.artisan.lvl))})` } })), h('small.muted', null, 'Chaque fabrication donne de l\'expérience d\'artisan. Les ressources se trouvent sur les monstres ou au marché.')),
        SETS.map((S) => {
          const c = craftCheck(st, S.id, Object.keys(S.pieces)[0]);
          const locked = !c.artisanOk || !c.heroOk;
          return h('div.set-card', { style: { '--sc': S.color }, cls: locked ? 'locked' : '' },
            h('div.set-head', null, h('b', null, S.name), h('small', null, `Héros niv. ${S.lvl} · Artisan ${S.artisan} · ${RARITIES[S.r].name}`)),
            h('div.set-bonus', null, Object.entries(S.bonus).map(([n, b]) => h('span', null, `${n} pièces : ` + Object.entries(b).map(([k, v]) => `+${v}% ${k === 'atk' ? 'ATQ' : k === 'hp' ? 'PV' : SUBSTATS[k] ? SUBSTATS[k].name : k}`).join(', ')))),
            h('div.set-cost', null, S.cost.map(([id, n]) => h('span.cost-it', { cls: (st.mats[id] || 0) >= n ? 'ok' : 'ko' }, h('span', { html: resIcon(id) }), `${fmt(st.mats[id] || 0)}/${n}`)), h('span.cost-it', { cls: st.res.gold >= c.gold ? 'ok' : 'ko', html: icon('gold') + fmt(c.gold) })),
            h('div.set-pieces', null, Object.entries(S.pieces).map(([slot, base]) => h('button.piece', { disabled: locked, onclick: () => g.craftPiece(S.id, slot) }, ui.itemImg(slot, adaptBase(st.hero.cls, slot, base), S.r), h('small', null, slotName(slot))))),
            locked ? h('p.small.muted', null, !c.heroOk ? `Niveau de héros ${S.lvl} requis` : `Artisan niveau ${S.artisan} requis`) : null,
          );
        }),
      );
    }
    if (tab === 'forge') {
      const items = [...Object.values(st.gear).filter(Boolean), ...st.bag];
      const target = items.find((x) => x.id === g.forgeTarget) || items.find((x) => x.set) || items[0];
      if (!target) return h('p.muted.center', null, 'Aucun objet à forger. Ouvrez des cartons ou fabriquez une panoplie.');
      g.forgeTarget = target.id;
      const n = target.upg || 0;
      const cost = forgeCost(target);
      const ch = forgeChance(target, g.useScroll);
      return h('div.col', null,
        h('div.forge-box', null,
          ui.itemCard(target, n >= FORGE_MAX ? 'MAX' : `+${n} → +${n + 1}`),
          n < FORGE_MAX ? h('div.forge-info', null,
            h('div.forge-chance', { cls: ch >= 60 ? 'good' : ch >= 25 ? 'mid' : 'bad' }, `${ch}% de réussite`),
            h('p.small.muted', null, n >= 7 ? 'Attention : en cas d\'échec l\'objet perd 1 niveau (sauf avec une Pierre de protection).' : 'Échec sans risque jusqu\'à +7.'),
            h('div.cost-line', null, h('span.cost-it', { cls: st.mats.rune >= cost.rune ? 'ok' : 'ko', html: resIcon('rune') + ` ${fmt(st.mats.rune)}/${cost.rune}` }), h('span.cost-it', { cls: st.res.gold >= cost.gold ? 'ok' : 'ko', html: icon('gold') + fmt(cost.gold) })),
            h('button.toggle', { cls: g.useStone ? 'on' : '', onclick: () => { g.useStone = !g.useStone; ui.refresh(); } }, h('span', { html: `${icon('stone')} Pierre de protection (${st.res.stone})` }), h('i')),
            h('button.toggle', { cls: g.useScroll ? 'on' : '', onclick: () => { g.useScroll = !g.useScroll; ui.refresh(); } }, h('span', { html: `${icon('scroll')} Parchemin +15% (${st.res.scroll})` }), h('i')),
            h('button.btn.gold.wide.forge-btn', { onclick: () => g.forgeItem(target) }, h('span', null, 'FORGER')),
          ) : h('p.center.good', null, 'Niveau de forge maximum !'),
        ),
        h('h4', null, 'Choisir un objet'),
        h('div.bag-grid', null, items.map((it) => h('button.bag-it', { cls: it.id === target.id ? 'sel' : '', onclick: () => { g.forgeTarget = it.id; ui.refresh(); } }, ui.itemIcon(it)))),
        h('p.small.muted.center', null, `Chances : ${[1, 4, 7, 10, 13, 15].map((k) => `+${k} ${[95, 90, 82, 74, 66, 58, 50, 42, 34, 27, 20, 14, 9, 6, 4][k - 1]}%`).join(' · ')}. Brisez les objets du sac pour obtenir des runes.`),
      );
    }
    if (tab === 'alchemy') {
      const now = Date.now();
      const active = [['atkUntil', 'Force'], ['hpUntil', 'Vitalité'], ['goldUntil', 'Fortune'], ['luckUntil', 'Chance'], ['royalUntil', 'Élixir Royal']].filter(([k]) => st.boost[k] > now);
      const trans = RESOURCES.filter((r) => r.r < 6 && (st.mats[r.id] || 0) >= TRANSMUTE_RATIO[r.r] && !['rune', 'gutterBadge', 'artDust'].includes(r.id));
      return h('div.col', null,
        active.length ? h('div.boosts', null, active.map(([k, n]) => h('span.boost-tag', null, n + ' · ', h('b', { dataset: { until: st.boost[k] } })))) : null,
        h('h4', null, 'Potions'),
        POTIONS.map((p) => h('div.potion', { style: { '--pc': p.color } },
          h('i.flask'), h('div.grow', null, h('b', null, `${p.name} (x${st.potions[p.id] || 0})`), h('small.muted', null, p.desc), h('div.set-cost', null, p.cost.map(([id, n]) => h('span.cost-it', { cls: (st.mats[id] || 0) >= n ? 'ok' : 'ko' }, h('span', { html: resIcon(id) }), `${fmt(st.mats[id] || 0)}/${n}`)))),
          h('div.btn-col', null, h('button.btn.sm.purple', { onclick: () => g.brew(p.id, 1) }, 'Préparer'), h('button.btn.sm.green', { disabled: !st.potions[p.id], onclick: () => g.drinkPotion(p.id) }, 'Boire')))),
        h('h4', null, 'Transmutation'),
        h('p.small.muted', null, `Transformez ${TRANSMUTE_RATIO[0]} ressources d'une rareté en 1 ressource aléatoire de la rareté supérieure.`),
        trans.length ? h('div.res-list', null, trans.map((r) => h('div.res-row', { cls: 'r' + r.r }, h('span', { html: resIcon(r.id) }), h('div.grow', null, h('b', null, r.name), h('small.muted', null, `x${fmt(st.mats[r.id])} · ${TRANSMUTE_RATIO[r.r]} → 1 ${RARITIES[r.r + 1].name}`)), h('button.btn.xs.purple', { onclick: () => g.transmuteRes(r.id) }, 'Transmuter')))) : h('p.muted.small', null, 'Pas assez de ressources identiques pour l\'instant.'),
      );
    }
    // ressources
    const owned = RESOURCES.filter((r) => (st.mats[r.id] || 0) > 0);
    return h('div.col', null,
      st.boost.cloverUntil > Date.now() ? h('p.center.good', null, 'Trèfle actif : butin x2 !') : h('button.btn.green.wide', { disabled: st.res.clover < 1, onclick: () => g.useClover() }, h('span', { html: `${icon('clover')} Utiliser un trèfle (butin x2 pendant 1 h) — ${st.res.clover}` })),
      h('p.small.muted', null, `Chance de butin : +${fmt(g.stats.luck)}% (équipement, chatons, VIP).`),
      owned.length ? h('div.res-list', null, owned.sort((a, b) => b.r - a.r).map((r) => h('div.res-row', { cls: 'r' + r.r },
        h('span', { html: resIcon(r.id) }), h('div.grow', null, h('b', null, r.name), h('small.muted', null, `${RARITIES[r.r].name} · ≈ ${fmt(unitPrice(st, r.id, 1))} or / u`)),
        h('b.cnt', null, 'x' + fmt(st.mats[r.id])),
        h('button.btn.xs.blue', { onclick: () => { ui.open('market', 'sell'); g.sellPick = r.id; ui.refresh(); } }, 'Vendre'),
      ))) : h('p.muted.center', null, 'Aucune ressource. Battez des monstres pour en trouver !'),
    );
  },
};

// ====================================================================== COMBAT (PvP + PvE)
const combat = {
  title: 'Combat',
  tabs: [['tower', 'Tour des Défis'], ['worldboss', 'Boss mondial'], ['lairs', 'Repaires'], ['arena', 'Arène'], ['war', 'Gouttières'], ['dungeons', 'Donjons']],
  tabDot: (g, id) => (id === 'worldboss' ? g.st.wb.tickets > 0 || g.wbClaimable() : id === 'lairs' ? g.st.lairs.tickets > 0 && g.st.camp.best >= 10 : id === 'dungeons' ? DUNGEONS.some((d) => g.st.dungeons[d.id].keys > 0) : id === 'arena' ? g.st.arena.tickets > 0 || g.arenaDailyClaimable() : id === 'war' ? g.st.war.energy > 0 || tributeAvailable(g.st) : id === 'tower' ? (g.st.daily.q.tower || 0) < 2 : false),
  render(ui, g, tab) {
    const st = g.st;
    if (tab === 'arena') {
      const lb = g.arenaBoard();
      const me = lb.find((x) => x.me);
      const div = divisionOf(me.rank);
      const opps = g.arenaOpponents();
      const face = (x) => (x.me ? g.portrait() : (() => { const l = botLoadout(x.bot); return catPortraitURL(l.ap, l.gear, 72); })());
      return h('div.col', null,
        h('div.arena-me', null,
          h('img', { src: g.portrait(), alt: '' }),
          h('div.grow', null, h('b', null, `Rang #${me.rank}`), h('div.div-badge', { style: { background: div.color } }, div.name), h('div.muted.small', { html: icon('power') + ' ' + fmt(g.stats.power) })),
          h('div.tickets', { html: icon('ticket') + ' ' + st.arena.tickets }),
          h('button.btn.sm.purple', { onclick: () => g.buyArenaTicket() }, '+'),
        ),
        g.arenaDailyClaimable() ? h('button.btn.gold.wide', { onclick: () => g.claimArenaDaily() }, h('span', null, 'Récompense du jour'), h('small', { html: icon('gems') + ' ' + arenaDailyGems(me.rank) })) : h('p.muted.small.center', null, 'Récompense quotidienne réclamée. Saison hebdomadaire : récompense selon la division.'),
        h('h4', null, 'Adversaires'),
        opps.map((o) => h('div.opp', null, h('img', { src: face(o), alt: '' }),
          h('div.grow', null, h('b', null, `#${o.rank} ${o.name}`), h('div.small', { html: icon('power') + ' ' + fmt(o.power) + (o.vip ? ` · <span class="vipc">VIP ${o.vip}</span>` : '') })),
          h('button.btn.sm', { cls: o.power < g.stats.power ? 'green' : 'red', disabled: st.arena.tickets <= 0, onclick: () => g.arenaFight(o.id) }, 'Défier'))),
        h('h4', null, 'Classement'),
        h('div.board', null, lb.slice(0, 10).concat(me.rank > 10 ? [me] : []).map((x) => h('div.brow', { cls: (x.me ? 'me ' : '') + (x.rank <= 3 ? 'top' + x.rank : '') },
          h('b.rk', null, '#' + x.rank), h('img', { src: face(x), alt: '' }),
          h('span.grow', null, x.name, x.vip ? h('small.vipc', null, ' VIP ' + x.vip) : null), h('b', { html: icon('power') + fmt(x.power) })))),
        h('div.divs', null, DIVISIONS.map((d) => h('span', { style: { color: d.color } }, d.name))),
        h('h4', null, 'Boutique d\'arène ', h('span.have', { html: icon('arenaCoins') + ' ' + fmt(st.res.arenaCoins) })),
        h('div.grid2', null, ARENA_SHOP.map((a) => {
          const bought = st.arena.shop[a.id] || 0;
          const out = bought >= a.limit;
          return h('div.shop-mini', null, chipsOf(ui, g, a.rewards), h('small.muted', null, `${bought}/${a.limit}`), h('button.btn.sm', { cls: out ? 'gray' : st.res.arenaCoins >= a.cost ? 'gold' : 'gray', disabled: out, onclick: () => g.arenaShopBuy(a.id) }, h('span', { html: icon('arenaCoins') + ' ' + fmt(a.cost) })));
        })),
      );
    }
    if (tab === 'war') {
      const w = st.war;
      const ranking = Object.entries(w.points).sort((a, b) => b[1] - a[1]);
      const mine = ownedTerritories(st).length;
      return h('div.col', null,
        h('div.war-head', null,
          h('div.grow', null, h('b', null, 'Guerre des Gouttières'), h('div.small.muted', null, `Votre clan : ${CLANS[0].name} · ${mine} toit(s)`)),
          h('div.tickets', { html: icon('combat') + ' ' + w.energy + '/' + WAR_ENERGY }),
          h('button.btn.sm.purple', { onclick: () => g.warBuyEnergy() }, h('span', null, '+'), h('small', { html: icon('gems') + warBuyCost(st) })),
        ),
        h('div.war-rank', null, ranking.map(([id, p], i) => h('div.wr', { style: { '--cc': CLAN_BY_ID[id].color }, cls: id === 'me' ? 'me' : '' }, h('b', null, `${i + 1}. ${CLAN_BY_ID[id].name}`), h('span', null, fmt(p) + ' pts')))),
        h('div.war-map', null, TERRITORIES.map((t) => {
          const T = w.terr[t.id];
          const C = CLAN_BY_ID[T.owner];
          const own = T.owner === 'me';
          return h('button.terr', { style: { '--cc': C.color }, cls: own ? 'own' : '', onclick: () => g.warTerritory(t.id) },
            h('b', null, t.name), h('small', null, C.name),
            h('div.hp', null, Array.from({ length: 3 }, (_, i) => h('i', { cls: i < T.hp ? 'on' : '' }))),
            h('span.pts', null, '+' + t.pts + '/h'),
            !own ? h('small.pow', { html: icon('power') + fmt(defenderPower(st, t)) }) : null);
        })),
        tributeAvailable(st) ? h('button.btn.gold.wide', { onclick: () => g.claimTribute() }, h('span', null, 'Récolter le tribut des toits'), h('small', null, `${mine} toit(s) contrôlé(s)`)) : null,
        w.log.length ? h('div.war-log', null, w.log.slice(0, 5).map((e) => h('div.small', null, `${CLAN_BY_ID[e.by].name} a pris « ${TERRITORIES.find((t) => t.id === e.t).name} »${e.from === 'me' ? ' (à vous !)' : ''}`))) : null,
        h('p.small.muted', null, 'Battez les 3 gardiens d\'un toit pour le capturer. Chaque toit rapporte des points toutes les heures ; les clans rivaux attaquent aussi. Classement remis à zéro chaque semaine.'),
        h('h4', null, 'Boutique de guerre ', h('span.have', { html: icon('warCoins') + ' ' + fmt(st.res.warCoins) })),
        h('div.grid2', null, WAR_SHOP.map((a) => {
          const bought = w.shop[a.id] || 0;
          const out = bought >= a.limit;
          return h('div.shop-mini', null, chipsOf(ui, g, a.rewards), h('small.muted', null, `${bought}/${a.limit}`), h('button.btn.sm', { cls: out ? 'gray' : st.res.warCoins >= a.cost ? 'gold' : 'gray', disabled: out, onclick: () => g.warShopBuy(a.id) }, h('span', { html: icon('warCoins') + ' ' + fmt(a.cost) })));
        })),
      );
    }
    if (tab === 'worldboss') {
      const W = st.wb, { B } = g.wbToday(), board = wbBoard(st), me = board.find((r) => r.me), vipMax = VIP_PERKS[g.stats.vip].dungeonBuys;
      const stat = (l, v) => h('div.wb-stat', null, h('small', null, l), h('b', null, v));
      return h('div.col', null,
        h('div.wb-head', null, ui.monsterImg(B.boss, 3, 'wb-img'),
          h('div.grow', null, h('small', null, 'TITAN DU JOUR'), h('b', null, B.name), h('p.small', null, '30 secondes pour infliger un maximum de dégâts. Le titan change chaque jour et s\'adapte à votre puissance.'))),
        h('div.wb-stats', null, stat('Dégâts du jour', fmt(W.today)), stat('Rang', W.today ? me.rank + 'e' : '—'), stat('Meilleur assaut', fmt(W.best))),
        h('div.btn-pair', null,
          h('button.btn', { cls: W.tickets > 0 ? 'red' : 'gray', disabled: W.tickets <= 0, onclick: () => g.startWorldBoss() }, h('span', null, 'Attaquer !'), h('small', null, `${W.tickets} ticket(s) · 3 gratuits/jour`)),
          h('button.btn', { cls: W.buys < vipMax ? 'purple' : 'gray', onclick: () => g.buyWbTicket() }, h('span', null, '+1 ticket'), h('small', { html: icon('gems') + ' ' + g.wbBuyCost() + ` · ${W.buys}/${vipMax}` }))),
        h('div.milestone', null, h('b', null, 'Récompense du jour (selon votre rang)'), chipsOf(ui, g, wbRankReward(me.rank)),
          h('button.btn', { cls: g.wbClaimable() ? 'gold' : 'gray', disabled: !g.wbClaimable(), onclick: () => g.claimWb() }, g.wbClaimable() ? 'Récupérer' : W.today ? 'Récupérée — revenez demain' : 'Attaquez au moins une fois')),
        h('h4', null, 'Classement du jour'),
        h('div.rank-list', null, board.slice(0, 20).map((r) => rankRow(r, fmt(r.dmg))), me.rank > 20 ? [h('div.rank-gap', null, '…'), rankRow(me, fmt(me.dmg))] : null),
      );
    }
    if (tab === 'lairs') {
      const L = st.lairs, vipMax = VIP_PERKS[g.stats.vip].dungeonBuys;
      return h('div.col', null,
        h('div.tower-head.lair-head', null, h('div.grow', null, h('b', null, `Tickets : ${L.tickets}`), h('div.small', null, `${LAIR_FREE} gratuits par jour · achats ${L.buys}/${vipMax}`)),
          h('button.btn.sm', { cls: L.buys < vipMax ? 'purple' : 'gray', onclick: () => g.buyLairTicket() }, h('span', null, '+1 ticket'), h('small', { html: icon('gems') + ' ' + lairBuyCost(L.buys) }))),
        h('p.small.muted', null, 'Affrontez à nouveau les boss de map déjà vaincus. Chaque victoire donne à coup sûr leur matériau de boss, indispensable aux panoplies de l\'Atelier. Le boss s\'adapte à votre progression.'),
        h('div.lairs', null, g.lairList().map((x) => h('div.lair', { cls: x.open ? '' : 'locked' },
          ui.monsterImg(x.B.boss, g.era().variant, 'lair-img'),
          h('div.grow', null, h('b', null, x.B.name), h('small.muted', null, `Map ${x.ch} · ${x.name}`), h('div.lair-drop', { html: resIcon(x.B.drop) + ' ' + RES_BY_ID[x.B.drop].name })),
          x.open ? h('button.btn.sm', { cls: L.tickets > 0 ? 'red' : 'gray', onclick: () => g.startLair(x.biome) }, 'Combattre') : h('span.small.muted', null, `Boss ${x.ch}-10`)))),
      );
    }
    if (tab === 'tower') {
      const f = st.tower.floor;
      const floors = [f + 3, f + 2, f + 1, f];
      const nextM = TOWER_MILESTONES.find((m) => m >= f) || (Math.ceil(f / 100) * 100);
      return h('div.col', null,
        h('div.tower-head', null, h('div.grow', null, h('b', null, `Étage ${f}`), h('div.small', null, `Record : ${st.tower.best} · étages infinis, difficulté sans plafond`)), h('span.have', null, fmt(st.res.towerTokens) + ' jetons')),
        h('button.btn.gold.wide.rank-btn', { onclick: () => towerRankModal(ui, g) }, h('span', null, `Classement : ${g.towerRank()}e sur 100`), h('small', null, g.towerRankClaimable() ? 'Récompense de la semaine disponible !' : 'Qui grimpera le plus haut ?'), g.towerRankClaimable() ? h('i.dot') : null),
        h('div.tower3', null, floors.map((x) => {
          const info = towerFloorInfo(x);
          const ms = towerMilestone(x);
          return h('div.tfloor', { cls: (x === f ? 'cur ' : '') + (info.boss ? 'boss' : '') },
            h('div.tf-num', null, x),
            h('div.grow', null,
              h('b', null, info.boss ? 'Gardien' : 'Défi'),
              (() => { const rec = powerForStage(towerStage(x)) * (info.boss ? 1.5 : 1) * (info.mods.length ? 1.15 : 1); return h('small.rec', { cls: g.stats.power >= rec ? 'ok' : 'ko', html: icon('power') + ' conseillé ' + fmt(rec) }); })(),
              info.mods.length ? h('div.mods', null, info.mods.map((m) => h('span.mod', null, m.name + ' : ' + m.desc))) : h('small.muted', null, 'Sans modificateur'),
              chipsOf(ui, g, ms ? { ...towerFloorReward(x), ...ms } : towerFloorReward(x))),
            x === f ? h('button.btn.green', { onclick: () => g.startTower() }, 'Combattre') : h('span.muted.small', null, 'À venir'));
        })),
        h('div.milestone', null, h('b', null, `Prochain palier : étage ${nextM}`), chipsOf(ui, g, towerMilestone(nextM) || {})),
        h('div.milestone.daily', null, h('b', null, 'Récompense du jour (selon votre record)'), chipsOf(ui, g, g.towerDailyInfo()),
          h('button.btn', { cls: st.daily.towerDaily || st.tower.best < 1 ? 'gray' : 'gold', disabled: st.daily.towerDaily || st.tower.best < 1, onclick: () => g.towerSweep() }, st.daily.towerDaily ? 'Récupérée — revenez demain' : 'Récupérer')),
        h('p.small.muted.center', null, 'Un modificateur par étage, un gardien tous les 10 étages, des cosmétiques exclusifs aux paliers 10, 25, 30, 50, 75, 100, 150, 200, 250, 300, 400, 500…'),
        h('h4', null, 'Boutique de la Tour'),
        h('div.grid2', null, TOWER_SHOP.map((a) => {
          const n = st.tower.shop[a.id] || 0;
          const out = n >= a.limit;
          return h('div.shop-mini', null, chipsOf(ui, g, a.rewards), h('small.muted', null, `${n}/${a.limit}`), h('button.btn.sm', { cls: out ? 'gray' : st.res.towerTokens >= a.cost ? 'gold' : 'gray', disabled: out, onclick: () => g.towerShopBuy(a.id) }, h('span', null, fmt(a.cost) + ' jetons')));
        })),
      );
    }
    const maxBuys = VIP_PERKS[g.stats.vip].dungeonBuys;
    return h('div.col', null, DUNGEONS.map((d) => {
      const ds = st.dungeons[d.id];
      const rew = dungeonReward(d.id, ds.lvl, st.camp.best);
      return h('div.dungeon', { style: { '--dc': d.color } },
        ui.monsterImg(d.enemy, 0, 'dg-img'),
        h('div.grow', null, h('b', null, d.name), h('div.muted.small', null, `Niveau ${ds.lvl} · ${d.desc}`), chipsOf(ui, g, rew), h('div.keys', { html: icon('key') + ` ${ds.keys}/${DUNGEON_FREE_KEYS}` })),
        h('div.dg-btns', null,
          h('button.btn.sm.green', { disabled: ds.keys <= 0, onclick: () => g.startDungeon(d.id) }, 'Combattre'),
          ds.lvl > 1 ? h('button.btn.sm.blue', { disabled: ds.keys <= 0, onclick: () => g.sweepDungeon(d.id) }, 'Balayer') : null,
          ds.buys < maxBuys ? h('button.btn.sm.purple', { onclick: () => g.buyDungeonKey(d.id) }, h('span', { html: '+1 ' + icon('key') }), h('small', { html: icon('gems') + ' ' + (100 * (ds.buys + 1)) })) : h('small.muted', null, `Max (VIP ${g.stats.vip})`)));
    }));
  },
};

// ====================================================================== MARCHÉ (Hôtel des ventes)
const market = {
  title: 'Hôtel des ventes',
  tabs: [['buy', 'Acheter'], ['sell', 'Vendre'], ['mine', 'Mes ventes'], ['change', 'Change']],
  tabDot: (g, id) => (id === 'mine' ? g.st.market.log.some((l) => l.t > (g.st.market.seenLog || 0)) : false),
  render(ui, g, tab) {
    const st = g.st, m = st.market;
    if (tab === 'buy') {
      const f = g.marketFilter || 'all';
      const list = RESOURCES.filter((r) => f === 'all' || (f === 'c' && r.r <= 1) || (f === 'r' && r.r >= 2 && r.r <= 3) || (f === 'b' && r.r === 4) || (f === 'u' && r.r >= 5));
      return h('div.col', null,
        h('div.seg.s5', null, [['all', 'Tout'], ['c', 'Communs'], ['r', 'Rares'], ['b', 'Boss'], ['u', 'Ultra']].map(([id, l]) => h('button', { cls: f === id ? 'on' : '', onclick: () => { g.marketFilter = id; ui.refresh(); } }, l))),
        h('p.small.muted', null, `Vous avez ${fmt(st.res.gold)} or. Prix par lot ; ils montent quand on achète et baissent quand on vend.`),
        list.map((r) => {
          const gd = m.goods[r.id];
          const tr = gd.hist.length > 1 ? ((gd.idx / gd.hist[0]) - 1) * 100 : 0;
          return h('div.mk-row', { cls: 'r' + r.r },
            h('span', { html: resIcon(r.id) }),
            h('div.grow', null, h('b', null, r.name), h('div.small', null, h('span.muted', null, `x${fmt(st.mats[r.id] || 0)} · `), h('span', { cls: tr >= 0 ? 'good' : 'bad' }, (tr >= 0 ? '▲' : '▼') + Math.abs(tr).toFixed(0) + '%'))),
            spark(gd.hist.concat([gd.idx])),
            h('div.lots', null, MARKET_LOTS.map((lot) => {
              const n = gd.stock[lot];
              return h('button.lot', { disabled: !n, cls: st.res.gold >= lotPrice(st, r.id, lot) && n ? 'ok' : '', onclick: () => g.marketBuy(r.id, lot) }, h('small', null, `x${lot}` + (n ? ` (${n})` : '')), h('b', null, n ? fmt(lotPrice(st, r.id, lot)) : '—'));
            })));
        }),
      );
    }
    if (tab === 'sell') {
      const owned = RESOURCES.filter((r) => (st.mats[r.id] || 0) > 0);
      const pickId = owned.some((r) => r.id === g.sellPick) ? g.sellPick : owned[0] && owned[0].id;
      if (!pickId) return h('p.muted.center', null, 'Rien à vendre. Battez des monstres pour récolter des ressources !');
      g.sellPick = pickId;
      const R = RES_BY_ID[pickId];
      const have = st.mats[pickId];
      const lot = MARKET_LOTS.includes(g.sellLot) && g.sellLot <= have ? g.sellLot : 1;
      g.sellLot = lot;
      const fair = Math.ceil(unitPrice(st, pickId, lot) * lot);
      if (!g.sellPrice || g.sellPriceKey !== pickId + lot) { g.sellPrice = Math.max(1, Math.floor(fair * 0.99)); g.sellPriceKey = pickId + lot; }
      const price = g.sellPrice;
      const ratio = price / fair;
      return h('div.col', null,
        h('div.sell-box', { cls: 'r' + R.r },
          h('div.sell-top', null, h('span', { html: resIcon(pickId) }), h('div.grow', null, h('b', null, R.name), h('small.muted', null, `Vous en avez ${fmt(have)}`))),
          h('div.seg', null, MARKET_LOTS.map((l) => h('button', { cls: l === lot ? 'on' : '', disabled: l > have, onclick: () => { g.sellLot = l; ui.refresh(); } }, 'Lot x' + l))),
          h('div.price-line', null,
            h('button.btn.sm.blue', { onclick: () => { g.sellPrice = Math.max(1, Math.round(price * 0.9)); ui.refresh(); } }, '−10%'),
            h('div.price', null, h('b', { html: icon('gold') + fmt(price) }), h('small', { cls: ratio <= 1 ? 'good' : ratio <= 1.2 ? '' : 'bad' }, `Prix moyen ${fmt(fair)} · ${ratio <= 0.95 ? 'vente rapide' : ratio <= 1.1 ? 'vente normale' : ratio <= 1.3 ? 'vente lente' : 'trop cher'}`)),
            h('button.btn.sm.blue', { onclick: () => { g.sellPrice = Math.round(price * 1.1) + 1; ui.refresh(); } }, '+10%'),
          ),
          h('div.btn-pair', null,
            h('button.btn.green', { onclick: () => g.marketList(pickId, lot, price) }, h('span', null, 'Mettre en vente'), h('small', null, `Taxe ${Math.round(MARKET_TAX * 100)}% : ${fmt(Math.ceil(price * MARKET_TAX))} or`)),
            h('button.btn.gold', { onclick: () => g.marketQuickSell(pickId, lot) }, h('span', null, 'Vente rapide'), h('small', null, `${fmt(Math.floor(unitPrice(st, pickId, 1) * lot * MARKET_QUICK_SELL))} or tout de suite`)),
          ),
        ),
        h('p.small.muted', null, `Emplacements de vente : ${m.listings.length}/${maxListings(st)} (plus avec le VIP).`),
        h('div.res-list', null, owned.map((r) => h('button.res-row', { cls: 'r' + r.r + (r.id === pickId ? ' sel' : ''), onclick: () => { g.sellPick = r.id; ui.refresh(); } }, h('span', { html: resIcon(r.id) }), h('div.grow', null, h('b', null, r.name)), h('b.cnt', null, 'x' + fmt(st.mats[r.id]))))),
      );
    }
    if (tab === 'mine') {
      m.seenLog = Date.now();
      return h('div.col', null,
        h('h4', null, `En vente (${m.listings.length}/${maxListings(st)})`),
        m.listings.length ? m.listings.map((l) => h('div.mk-row', { cls: 'r' + RES_BY_ID[l.id].r }, h('span', { html: resIcon(l.id) }), h('div.grow', null, h('b', null, `${RES_BY_ID[l.id].name} x${l.lot}`), h('small.muted', null, `Mis en vente il y a ${fmtTime((Date.now() - l.t) / 1000)}`)), h('b', { html: icon('gold') + fmt(l.price) }), h('button.btn.xs.red', { onclick: () => g.marketCancel(l.uid) }, 'Retirer'))) : h('p.muted.small', null, 'Aucune annonce.'),
        h('h4', null, 'Ventes récentes'),
        m.log.length ? m.log.map((l) => h('div.small.sold', null, `✓ ${RES_BY_ID[l.id].name} x${l.lot} vendu ${fmt(l.price)} or · il y a ${fmtTime((Date.now() - l.t) / 1000)}`)) : h('p.muted.small', null, 'Pas encore de vente. Les autres joueurs achètent même quand vous êtes hors ligne.'),
      );
    }
    // bureau de change
    const sell = gemSellRate(st), buy = gemBuyRate(st);
    const left = gemBuyLimit(st) - (st.daily.changeBought || 0);
    return h('div.col', null,
      h('div.change-card', null,
        h('b', null, 'Bureau de change'),
        h('p.small', null, 'Vendez vos gemmes contre de l\'or, ou achetez des gemmes avec l\'or de vos ventes. Le cours bouge chaque heure.'),
        h('div.rate', { html: `1 ${icon('gems')} = ${fmt(sell)} ${icon('gold')} (vente) · ${fmt(buy)} ${icon('gold')} (achat)` }),
      ),
      h('h4', null, 'Vendre des gemmes'),
      h('div.grid3', null, [10, 100, 1000].map((n) => h('button.btn', { cls: st.res.gems >= n ? 'purple' : 'gray', disabled: st.res.gems < n, onclick: () => g.sellGems(n) }, h('span', { html: icon('gems') + n }), h('small', { html: '→ ' + icon('gold') + fmt(sell * n) })))),
      h('h4', null, `Acheter des gemmes (reste ${left} aujourd'hui)`),
      h('div.grid3', null, [10, 50, 100].map((n) => h('button.btn', { cls: left >= n && st.res.gold >= buy * n ? 'gold' : 'gray', disabled: left < n, onclick: () => g.buyGems(n) }, h('span', { html: icon('gems') + n }), h('small', { html: icon('gold') + fmt(buy * n) })))),
      h('p.legal', null, 'Échanges uniquement à l\'intérieur du jeu : aucune monnaie du jeu ne peut être reconvertie en argent réel.'),
    );
  },
};

// ====================================================================== BOUTIQUE
function productCard(ui, g, id, opts = {}) {
  const p = PRODUCTS[id];
  const st = g.st;
  const bought = st.iap.bought[id] || 0;
  const soldOut = (p.kind === 'once' && bought) || (p.kind === 'daily' && st.iap.daily[id]) || (p.kind === 'weekly' && st.iap.weekly[id]);
  const val = p.rewards ? g.productValue(id) : 0;
  return h('div.pcard', { cls: (opts.cls || '') + (soldOut ? ' sold' : ''), onclick: () => !soldOut && g.showProduct(id) },
    p.tag ? h('span.ptag', null, p.tag) : null,
    h('b.pname', null, p.name),
    p.rewards ? chipsOf(ui, g, p.rewards) : h('p.small', null, p.desc || ''),
    val > 3 ? h('span.pval', null, `x${Math.round(val)} valeur`) : null,
    h('button.btn.price', { cls: soldOut ? 'gray' : 'green', disabled: soldOut }, soldOut ? (p.kind === 'once' ? 'Acheté' : 'Épuisé') : fmtEuro(p.price)),
  );
}
const shop = {
  title: 'Boutique',
  tabs: [['offers', 'Offres'], ['relics', 'Reliques'], ['artifacts', 'Artefacts'], ['style', 'Style'], ['gems', 'Gemmes'], ['cards', 'Cartes'], ['loyalty', 'Fidélité'], ['pass', 'Passe'], ['vip', 'VIP']],
  tabDot: (g, id) => (id === 'offers' ? !g.st.daily.freeGift : id === 'vip' ? g.vipGiftClaimable() : id === 'cards' ? g.fundClaimable() : id === 'pass' ? g.passClaimable() : id === 'loyalty' ? g.loyaltyClaimable() : id === 'artifacts' ? !g.st.daily.artFree : false),
  render(ui, g, tab) {
    const st = g.st;
    if (tab === 'offers') {
      const flash = st.iap.flash && st.iap.flash.until > Date.now() ? st.iap.flash : null;
      return h('div.col', null,
        h('div.free-gift', { cls: st.daily.freeGift ? 'done' : '' }, h('span', { html: icon('gift') }), h('div.grow', null, h('b', null, 'Cadeau gratuit du jour'), h('div.small.muted', null, '300 pelotes + 20 gemmes')),
          h('button.btn.sm', { cls: st.daily.freeGift ? 'gray' : 'green', disabled: st.daily.freeGift, onclick: () => g.claimFreeGift() }, st.daily.freeGift ? 'Reçu' : 'Gratuit')),
        flash ? h('div.flash-wrap', null, h('div.flash-title', null, h('b', null, 'OFFRE FLASH'), h('span', { dataset: { until: flash.until } })), productCard(ui, g, flash.id, { cls: 'hot' })) : null,
        !st.iap.bought.starter ? productCard(ui, g, 'starter', { cls: 'starter' }) : null,
        h('h4', null, 'Offres du jour'),
        h('div.grid3', null, ['daily_1', 'daily_2', 'daily_3'].map((id) => productCard(ui, g, id))),
        h('h4', null, 'Offres de la semaine'),
        h('div.grid2', null, ['weekly_1', 'weekly_2', 'forge', 'luck'].map((id) => productCard(ui, g, id))),
        productCard(ui, g, 'relic_pack', { cls: 'big cyber' }),
        h('h4', null, 'Packs légendaires'),
        ['kittens', 'ninja', 'cyber', 'whale'].map((id) => productCard(ui, g, id, { cls: 'big ' + id })),
        h('h4', null, 'Échanges contre gemmes'),
        h('div.grid2', null, g.exchanges().map((x) => h('div.shop-mini', null, chipsOf(ui, g, x.rewards), h('button.btn.sm', { cls: st.res.gems >= x.gems ? 'purple' : 'gray', onclick: () => g.exchange(x.id) }, h('span', { html: icon('gems') + ' ' + fmt(x.gems) }))))),
        h('p.legal', null, 'Achats simulés : aucun paiement réel n\'est effectué dans cette version.'),
      );
    }
    if (tab === 'relics') {
      const each = RELIC_CHEST.relicPct / RELICS.length;
      const tot = RELIC_CONSOLATION.reduce((a, c) => a + c.p, 0);
      return h('div.col', null,
        h('div.relic-card', null,
          h('b', null, 'Coffre des Reliques'),
          h('p.small', null, 'Dix reliques uniques, les objets les plus puissants du jeu : leur niveau suit toujours celui de votre héros et chacune a un effet spécial.'),
          h('div.summon-btns', null,
            h('button.btn.summon', { cls: st.res.relicKeys >= 1 ? 'green' : 'purple', onclick: () => g.relicPull(1) }, h('span', null, 'x1'), h('small', { html: st.res.relicKeys >= 1 ? icon('relicKeys') + ' 1' : icon('gems') + ' ' + RELIC_CHEST.cost1 })),
            h('button.btn.summon', { cls: st.res.relicKeys >= 10 ? 'green' : 'purple', onclick: () => g.relicPull(10) }, h('span', null, 'x10'), h('small', { html: st.res.relicKeys >= 10 ? icon('relicKeys') + ' 10' : icon('gems') + ' ' + fmt(RELIC_CHEST.cost10) }))),
          h('div.pity', null, `Relique garantie dans ${RELIC_CHEST.pity - st.relic.pity} tirages · Clés : ${st.res.relicKeys}`),
        ),
        h('h4', null, 'Probabilités par tirage'),
        h('div.odds', null,
          h('div.orow', { style: { '--rc': '#fff27a' } }, h('i'), h('span', null, `Une relique (au choix du sort)`), h('b', null, RELIC_CHEST.relicPct + '%'), h('em', null, `${pct(each)} chacune`)),
          RELIC_CONSOLATION.map((c) => h('div.orow', { style: { '--rc': '#8a6cf0' } }, h('i'), h('span', null, g.previewRewards(c.rewards).map((r) => `${fmt(r.v)} ${(RES_BY_ID[r.k] || {}).name || ({ yarn: 'pelotes', eggs: 'paniers', feathers: 'plumes', stone: 'pierre de protection', clover: 'trèfle' })[r.k] || r.k}`).join(', ')), h('b', null, pct(c.p * (100 - RELIC_CHEST.relicPct) / tot)), null))),
        h('h4', null, 'Les reliques'),
        RELICS.map((R) => h('div.relic-row', null, ui.itemImg(R.slot, R.base, 8), h('div.grow', null, h('b', null, R.name), h('small', null, `${slotName(R.slot)} · ${R.desc}`)), [...Object.values(st.gear), ...st.bag].some((x) => x && x.relic === R.id) ? h('span.check', null, '✓') : null)),
      );
    }
    if (tab === 'artifacts') {
      const tot = ARTIFACT_CHEST.odds.reduce((a, b) => a + b, 0);
      return h('div.col', null,
        h('div.relic-card.art', null, h('b', null, 'Coffre d\'artefacts'), h('p.small', null, 'Chaque coffre donne 2 à 4 fragments d\'un artefact et de la poussière. 10 fragments débloquent un artefact, les suivants ajoutent des étoiles.'),
          h('div.summon-btns', null,
            !st.daily.artFree ? h('button.btn.summon.gold', { onclick: () => g.artifactPull(1) }, h('span', null, 'Gratuit'), h('small', null, '1 / jour')) : h('button.btn.summon.purple', { onclick: () => g.artifactPull(1) }, h('span', null, 'x1'), h('small', { html: icon('gems') + ' ' + ARTIFACT_CHEST.cost1 })),
            h('button.btn.summon.purple', { onclick: () => g.artifactPull(10) }, h('span', null, 'x10'), h('small', { html: icon('gems') + ' ' + fmt(ARTIFACT_CHEST.cost10) })))),
        h('h4', null, 'Probabilités par coffre'),
        h('div.odds', null, ARTIFACT_CHEST.odds.map((p, r) => (p ? h('div.orow', { style: { '--rc': RARITIES[r].color } }, h('i'), h('span', null, `Artefact ${RARITIES[r].name}`), h('b', null, pct((p / tot) * 100)), h('em', null, `${ARTIFACTS.filter((a) => a.r === r).length} artefacts`)) : null))),
      );
    }
    if (tab === 'style') {
      const C = st.cos;
      return h('div.col', null,
        h('p.small.muted', null, 'Auras, cadres et costumes exclusifs. Tout ce que vous possédez renforce votre chat pour toujours.'),
        h('div.grid3', null, STYLE_SHOP.map((it, i) => {
          const owned = it.kind === 'aura' ? C.auras.includes(it.id) : it.kind === 'frame' ? C.frames.includes(it.id) : st.costumes.owned.includes(it.id);
          const R = it.kind === 'aura' ? AURAS.find((a) => a.id === it.id) : it.kind === 'frame' ? FRAMES.find((f) => f.id === it.id) : COSTUMES.find((c) => c.id === it.id);
          return h('div.style-card', { cls: 'r' + R.r, style: rr(R.r) },
            it.kind === 'aura' ? h('span.aura-prev', { style: { '--a1': R.colors[0], '--a2': R.colors[1] || R.colors[0] } }) : it.kind === 'frame' ? h('span.frame-prev', { dataset: { frame: R.id } }, h('img', { src: g.portrait(), alt: '' })) : ui.costumeImg(R.id, 'cos-img'),
            h('b', null, R.name), h('small', null, it.kind === 'aura' ? 'Aura' : it.kind === 'frame' ? 'Cadre' : 'Costume'),
            h('button.btn.xs', { cls: owned ? 'gray' : 'purple', disabled: owned, onclick: () => g.buyStyle(i) }, owned ? 'Possédé' : h('span', { html: icon('gems') + fmt(it.gems) })));
        })),
      );
    }
    if (tab === 'loyalty') {
      const spent = st.iap.spent;
      return h('div.col', null,
        h('div.relic-card', null, h('b', null, 'Récompenses de fidélité'), h('p.small', null, `Chaque achat compte, pour toujours. Total : ${fmtEuro(spent)}.`)),
        LOYALTY.map((L, i) => {
          const ok = spent >= L.cents, got = st.loyalty.includes(i);
          return h('div.loyal-row', { cls: got ? 'done' : ok ? 'ready' : '' }, h('b.lv', null, fmtEuro(L.cents)), chipsOf(ui, g, L.rewards),
            got ? h('span.check', null, '✓') : h('button.btn.sm', { cls: ok ? 'gold' : 'gray', disabled: !ok, onclick: () => g.claimLoyalty(i) }, ok ? 'Prendre' : h('span', { html: icon('lock') })));
        }),
      );
    }
    if (tab === 'gems') {
      return h('div.col', null,
        h('div.grid3', null, ['gems_1', 'gems_2', 'gems_3', 'gems_4', 'gems_5', 'gems_6'].map((id, i) => {
          const p = PRODUCTS[id];
          const first = !st.iap.bought[id];
          return h('button.gem-tile', { onclick: () => g.showProduct(id) }, first ? h('span.x2', null, 'x2') : null, h('div.gem-pile', { cls: 'g' + i, html: icon('gems') }),
            h('b', null, fmt(p.gems * (first ? 2 : 1))), first ? h('small.muted.strike', null, fmt(p.gems)) : h('small.muted', null, 'gemmes'), h('span.btn.green.price', null, fmtEuro(p.price)));
        })),
        h('p.muted.small.center', null, 'Premier achat de chaque palier : gemmes doublées !'),
      );
    }
    if (tab === 'cards') {
      const now = Date.now();
      const monthlyLeft = st.iap.monthlyUntil > now ? Math.ceil((st.iap.monthlyUntil - now) / 864e5) : 0;
      return h('div.col', null,
        h('div.card-offer.monthly', null, h('b', null, 'Carte Mensuelle'), h('p.small', null, PRODUCTS.monthly.desc), monthlyLeft ? h('div.active', null, `Active — ${monthlyLeft} jours restants`) : null,
          h('button.btn.green.price', { onclick: () => g.showProduct('monthly') }, (monthlyLeft ? 'Prolonger ' : '') + fmtEuro(PRODUCTS.monthly.price))),
        h('div.card-offer.lifetime', null, h('b', null, 'Sans Pub à vie'), h('p.small', null, PRODUCTS.noads.desc), st.iap.noads ? h('div.active', null, 'Actif pour toujours') : h('button.btn.gold.price', { onclick: () => g.showProduct('noads') }, fmtEuro(PRODUCTS.noads.price))),
        h('div.card-offer.fund', null, h('b', null, 'Fonds de croissance'), h('p.small', null, PRODUCTS.fund.desc), st.iap.fund ? h('div.active', null, 'Acheté') : h('button.btn.purple.price', { onclick: () => g.showProduct('fund') }, fmtEuro(PRODUCTS.fund.price)),
          h('div.fund-list', null, FUND_TIERS.map((f, i) => {
            const claimed = st.iap.fundClaimed.includes(i);
            const reached = st.camp.best >= f.stage;
            return h('div.fund-row', { cls: claimed ? 'done' : reached ? 'ready' : '' }, h('span', null, `Étape ${Math.floor((f.stage - 1) / 10) + 1}-${((f.stage - 1) % 10) + 1}`), h('b', { html: icon('gems') + ' ' + fmt(f.gems) }),
              claimed ? h('span.check', null, '✓') : h('button.btn.sm', { cls: st.iap.fund && reached ? 'green' : 'gray', disabled: !st.iap.fund || !reached, onclick: () => g.claimFund(i) }, 'Réclamer'));
          }))),
      );
    }
    if (tab === 'pass') {
      const tier = passTier(st);
      const xpIn = st.pass.xp - tier * PASS_XP_PER_TIER;
      return h('div.col', null,
        h('div.pass-head', null,
          h('div', null, h('b', null, 'Passe Royal'), h('div.small', null, `Palier ${tier}/30`), h('div.bar.wide', null, h('i', { style: { transform: `scaleX(${tier >= 30 ? 1 : xpIn / PASS_XP_PER_TIER})` } }))),
          st.iap.pass ? h('span.badge.gold', null, st.iap.pass === 2 ? 'DELUXE' : 'PREMIUM') : h('div.btn-col', null, h('button.btn.sm.gold', { onclick: () => g.showProduct('pass') }, 'Premium ' + fmtEuro(PRODUCTS.pass.price)), h('button.btn.sm.purple', { onclick: () => g.showProduct('pass_deluxe') }, 'Deluxe ' + fmtEuro(PRODUCTS.pass_deluxe.price)))),
        g.passClaimable() ? h('button.btn.green.wide', { onclick: () => g.claimAllPass() }, 'Tout réclamer') : null,
        h('div.pass-list', null, PASS_TIERS.map((t) => {
          const ok = tier >= t.t;
          const cf = st.pass.free.includes(t.t), cp = st.pass.prem.includes(t.t);
          return h('div.pass-row', { cls: ok ? 'ok' : '' }, h('b.pt', null, t.t),
            h('div.pcell', null, chipsOf(ui, g, t.free), cf ? h('span.check', null, '✓') : h('button.btn.xs', { cls: ok ? 'green' : 'gray', disabled: !ok, onclick: () => g.claimPass(t.t, false) }, 'Prendre')),
            h('div.pcell.prem', null, chipsOf(ui, g, t.prem), cp ? h('span.check', null, '✓') : h('button.btn.xs', { cls: ok && st.iap.pass ? 'gold' : 'gray', disabled: !ok || !st.iap.pass, onclick: () => g.claimPass(t.t, true) }, st.iap.pass ? 'Prendre' : h('span', { html: icon('lock') }))));
        })),
      );
    }
    const vip = g.stats.vip;
    const pts = st.iap.vip;
    const next = VIP_THRESHOLDS[vip + 1];
    return h('div.col', null,
      h('div.vip-card', null, h('div.vip-big', { html: icon('crown') + `<b>VIP ${vip}</b>` }),
        next ? h('div.grow', null, h('div.small', null, `Encore ${fmtEuro(next - pts)} d'achats pour VIP ${vip + 1}`), h('div.bar.wide.gold', null, h('i', { style: { transform: `scaleX(${(pts - VIP_THRESHOLDS[vip]) / (next - VIP_THRESHOLDS[vip])})` } }))) : h('b.grow', null, 'Empereur des Chats !')),
      vip > 0 ? h('button.btn.wide', { cls: g.vipGiftClaimable() ? 'gold' : 'gray', disabled: !g.vipGiftClaimable(), onclick: () => g.claimVipGift() }, h('span', null, 'Coffre VIP quotidien'), h('small', { html: icon('gems') + ' ' + VIP_PERKS[vip].dailyGems + ' + ' + icon('yarn') + ' ' + vip * 150 })) : null,
      h('div.vip-list', null, VIP_TEXT.map((t, i) => h('div.vip-row', { cls: i === vip ? 'cur' : i < vip ? 'got' : '' }, h('b', null, 'VIP ' + i),
        h('div.grow', null, h('div', null, t), h('small.muted', null, `ATQ/PV +${VIP_PERKS[i].stat}% · Butin +${VIP_PERKS[i].luck}% · ${VIP_PERKS[i].kittenSlots} chatons · ${8 + i * 2} ventes`)), h('small.muted', null, fmtEuro(VIP_THRESHOLDS[i]))))),
    );
  },
};

// ====================================================================== QUÊTES
const quests = {
  title: 'Quêtes',
  tabs: [['daily', 'Du jour'], ['login', 'Connexion'], ['ach', 'Objectifs']],
  tabDot: (g, id) => (id === 'daily' ? g.dailyClaimable() : id === 'login' ? g.loginClaimable() : g.achClaimable()),
  render(ui, g, tab) {
    const st = g.st, d = st.daily;
    if (tab === 'daily') {
      return h('div.col', null,
        h('div.activity', null, h('b', null, `Activité ${d.pts}/100`),
          h('div.act-track', null, h('i', { style: { transform: `scaleX(${Math.min(1, d.pts / 100)})` } }),
            DAILY_CHESTS.map((c, i) => h('button.act-chest', { cls: d.chests.includes(i) ? 'done' : d.pts >= c.pts ? 'ready' : '', style: { left: c.pts + '%' }, onclick: () => (d.pts >= c.pts && !d.chests.includes(i) ? g.claimChest(i) : ui.rewards(g.previewRewards(c.rewards), `Coffre ${c.pts} points`)) }, h('span', { html: icon('chest') }), h('small', null, c.pts))))),
        DAILY_QUESTS.map((q) => {
          const v = d.q[q.id] || 0;
          const done = d.qDone.includes(q.id);
          return h('div.list-row', null, h('div.grow', null, h('b', null, q.name), h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, v / q.goal)})` } }), h('small', null, `${Math.min(v, q.goal)}/${q.goal}`))),
            h('span.pts', null, '+' + q.pts), done ? h('span.check', null, '✓') : h('button.btn.sm', { cls: v >= q.goal ? 'green' : 'gray', disabled: v < q.goal, onclick: () => g.claimQuest(q.id) }, 'Valider'));
        }),
      );
    }
    if (tab === 'login') {
      const L = st.login;
      const todayOk = g.loginClaimable();
      return h('div.col', null,
        h('p.muted.center', null, 'Connectez-vous 7 jours pour le costume Siamois Élégant !'),
        h('div.login-grid', null, LOGIN_CALENDAR.map((r, i) => h('div.lday', { cls: (i < L.claimed % 7 ? 'done ' : '') + (i === L.claimed % 7 && todayOk ? 'ready ' : '') + (i === 6 ? 'big' : '') }, h('b', null, 'Jour ' + (i + 1)), chipsOf(ui, g, r), i < L.claimed % 7 ? h('span.check', null, '✓') : null))),
        h('button.btn.green.wide', { disabled: !todayOk, onclick: () => g.claimLogin() }, todayOk ? 'Récupérer' : 'Revenez demain'),
      );
    }
    return h('div.col', null, ACHIEVEMENTS.map((a) => {
      const v = g.achValue(a);
      const done = st.ach.includes(a.id);
      return h('div.list-row', { cls: done ? 'dim' : '' }, h('div.grow', null, h('b', null, a.name), h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, v / a.goal)})` } }), h('small', null, `${fmt(Math.min(v, a.goal))}/${fmt(a.goal)}`))),
        h('span.small', { html: icon('gems') + ' ' + a.gems }), done ? h('span.check', null, '✓') : h('button.btn.sm', { cls: v >= a.goal ? 'green' : 'gray', disabled: v < a.goal, onclick: () => g.claimAch(a.id) }, 'Réclamer'));
    }));
  },
};

const ads = {
  title: 'Vidéos bonus',
  render(ui, g) {
    const st = g.st;
    const lim = g.adLimit();
    const left = lim - st.daily.ads;
    return h('div.col', null,
      h('p.center', null, `Regardez une courte vidéo pour un bonus gratuit. Restantes aujourd'hui : ${left}/${lim}`),
      st.iap.noads ? h('p.center.good', null, 'Sans Pub à vie : bonus instantanés !') : h('button.btn.gold.wide', { onclick: () => g.showProduct('noads') }, h('span', null, 'Sans Pub à vie'), h('small', null, `${fmtEuro(PRODUCTS.noads.price)} · bonus instantanés pour toujours`)),
      h('div.grid2', null, AD_REWARDS.map((r, i) => h('div.shop-mini', null, chipsOf(ui, g, r), h('button.btn.sm', { cls: left > 0 ? 'green' : 'gray', disabled: left <= 0, onclick: () => g.watchAd(() => g.grantAd(i)) }, h('span', { html: icon('tv') + ' Regarder' }))))),
      h('p.legal', null, 'Vidéos simulées : brancher une régie publicitaire (ex. AdMob) pour la version publiée.'),
    );
  },
};
const firstRecharge = {
  title: 'Bonus de premier achat',
  render(ui, g) {
    const st = g.st;
    return h('div.col.first-rech', null,
      h('div.fr-hero', null, h('b', null, 'Faites n\'importe quel achat'), h('span', null, 'et recevez en plus :')),
      chipsOf(ui, g, FIRST_RECHARGE),
      st.iap.firstRecharge === 1 ? h('button.btn.gold.wide', { onclick: () => g.claimFirstRecharge() }, 'Réclamer maintenant !') : h('button.btn.green.wide', { onclick: () => g.showProduct('gems_1') }, 'Dès ' + fmtEuro(99)),
      h('p.muted.small.center', null, 'Pouvoir Laser Oculaire + chaton Mythique Drakou (ultime de feu) : de quoi dominer les premiers chapitres.'),
    );
  },
};
const settings = {
  title: 'Paramètres',
  render(ui, g) {
    const st = g.st;
    const q = st.settings.quality;
    const tog = (k, label) => h('button.toggle', { cls: st.settings[k] ? 'on' : '', onclick: () => g.setSetting(k, !st.settings[k]) }, h('span', null, label), h('i'));
    const caps = [[0, 'Aucune'], [1000, '10 €'], [5000, '50 €'], [10000, '100 €'], [50000, '500 €']];
    return h('div.col', null,
      h('h4', null, 'Qualité graphique'),
      h('div.seg', null, [['auto', 'Auto'], ['high', 'Haute'], ['medium', 'Moyenne'], ['low', 'Basse']].map(([id, l]) => h('button', { cls: q === id ? 'on' : '', onclick: () => g.setSetting('quality', id) }, l))),
      h('p.muted.small', null, `FPS mesurés : ${Math.round(g.fps || 0)} · rendu ${g.stage.quality}`),
      tog('sound', 'Effets sonores'), tog('music', 'Musique'),
      h('h4', null, 'Limite de dépenses mensuelle'),
      h('div.seg.s5', null, caps.map(([v, l]) => h('button', { cls: st.settings.capCents === v ? 'on' : '', onclick: () => g.setSetting('capCents', v) }, l))),
      h('p.small.muted', null, `Dépensé ce mois-ci : ${fmtEuro(g.monthSpent())} · total : ${fmtEuro(st.iap.spent)}. Les achats au-delà de la limite sont bloqués.`),
      h('h4', null, 'Partie'),
      h('p.small.muted', null, `Créée le ${new Date(st.created).toLocaleDateString('fr-FR')} · ${fmt(st.stats.opens)} cartons · ${st.stats.kittensFound} chatons · ${st.stats.crafts} fabrications`),
      h('button.btn.red.wide', { onclick: (e) => { const b = e.currentTarget; if (b.dataset.armed) g.resetGame(); else { b.dataset.armed = '1'; b.firstChild.textContent = 'Toucher encore pour tout effacer'; } } }, h('span', null, 'Recommencer la partie')),
      h('p.legal', null, 'Miaou Empire — prototype. Achats, publicités, marché et adversaires PvP simulés. Toutes les probabilités sont affichées dans le jeu.'),
    );
  },
};

export const PANELS = { hero, kittens, atelier, combat, market, shop, quests, ads, firstRecharge, settings, guild: guildPanel, event: eventPanel, bestiary: bestiaryPanel, altar: altarPanel };
