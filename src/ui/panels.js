// Contenu des panneaux (feuilles) de l'interface
import { h, fmt, fmtPct, fmtTime, fmtEuro } from '../util.js';
import { icon } from './icons.js';
import {
  RARITIES, SUBSTATS, TRAININGS, trainingCost, SKILLS, PETS, SKINS, SKILL_PASSIVE_ATK, PET_EQUIP_ATK, PET_OWN_HP,
  SKILL_RARITY_ODDS, PET_RARITY_ODDS, SKILL_PITY_LEG, SKILL_PITY_DIV, PET_PITY_LEG, dupNeed, VIP_PERKS, VIP_THRESHOLDS,
  VIP_TEXT, PRODUCTS, FUND_TIERS, PASS_TIERS, PASS_XP_PER_TIER, DAILY_QUESTS, DAILY_CHESTS, LOGIN_CALENDAR,
  ACHIEVEMENTS, DUNGEONS, dungeonReward, towerReward, ARENA_SHOP, arenaDailyGems, AD_LIMIT, AD_REWARDS, FIRST_RECHARGE,
  DUNGEON_FREE_KEYS,
} from '../config.js';
import { SKILL_BY_ID, PET_BY_ID, SKIN_BY_ID, skillLevelMult, petLevelMult } from '../stats.js';
import { passTier } from '../economy.js';

const rr = (r) => ({ '--rc': RARITIES[r].color, '--rd': RARITIES[r].dark });
const chipsOf = (ui, g, rewards) => h('div.rewards.sm', null, g.previewRewards(rewards).map((r) => ui.rewardChip(r)));
const costBtn = (label, res, amount, fn, cls = 'gold', disabled) => h('button.btn', { cls, disabled, onclick: fn }, h('span', null, label), h('small', { html: icon(res) + ' ' + fmt(amount) }));

// ====================================================================== HÉROS
const hero = {
  title: 'Héros',
  tabs: [['stats', 'Statistiques'], ['train', 'Entraînement'], ['skins', 'Costumes']],
  tabDot: (g, id) => id === 'train' && g.trainAffordable(),
  render(ui, g, tab) {
    const st = g.st, S = g.stats;
    if (tab === 'stats') {
      const rows = [
        ['ATQ', fmt(S.atk)], ['PV', fmt(S.hp)], ['DÉF', fmt(S.def)],
        ...Object.keys(SUBSTATS).map((k) => [SUBSTATS[k].name, fmtPct(S[k])]),
      ];
      return h('div.col', null,
        h('div.hero-card', null,
          h('img.hero-img', { src: ui.snaps['skin_' + st.skins.current] || '', alt: '' }),
          h('div', null,
            h('b.big', null, 'Minou'),
            h('div.muted', null, `Niveau ${st.hero.lvl} · ${SKIN_BY_ID[st.skins.current].name}`),
            h('div.power.lg', { html: icon('power') + fmt(S.power) }),
            h('div.muted.small', null, 'Chaque carton ouvert donne de l\'expérience.'),
          ),
        ),
        h('div.stat-grid', null, rows.map(([k, v]) => h('div.srow', null, h('span', null, k), h('b', null, v)))),
        h('h4', null, 'Bonus de puissance'),
        h('div.stat-grid', null,
          h('div.srow', null, h('span', null, 'ATQ totale'), h('b.good', null, '+' + fmt(S.atkPct) + '%')),
          h('div.srow', null, h('span', null, 'PV totaux'), h('b.good', null, '+' + fmt(S.hpPct) + '%')),
          h('div.srow', null, h('span', null, 'Bonus VIP ' + S.vip), h('b.vipc', null, '+' + VIP_PERKS[S.vip].stat + '%')),
          h('div.srow', null, h('span', null, 'Costumes possédés'), h('b', null, st.skins.owned.length + '/' + SKINS.length)),
        ),
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
            maxed ? h('b.muted', null, 'MAX') : h('div.btn-pair', null,
              costBtn('+1', 'gold', cost, () => g.trainN(t.id, 1), st.res.gold >= cost ? 'gold' : 'gray'),
              h('button.btn.sm.blue', { onclick: () => g.trainN(t.id, 25) }, 'x25'),
            ),
          );
        }),
        h('p.muted.small.center', null, 'L\'entraînement augmente vos statistiques en pourcentage, pour toujours.'),
      );
    }
    // costumes
    return h('div.grid2', null, SKINS.map((s) => {
      const owned = st.skins.owned.includes(s.id);
      const cur = st.skins.current === s.id;
      const bon = [s.atk ? `+${s.atk}% ATQ` : '', s.hp ? `+${s.hp}% PV` : '', s.crit ? `+${s.crit}% Crit.` : '', s.critDmg ? `+${s.critDmg}% Dég. crit.` : '', s.dodge ? `+${s.dodge}% Esquive` : ''].filter(Boolean).join(' · ') || 'Classique';
      let btn;
      if (cur) btn = h('button.btn.sm.gray', { disabled: true }, 'Porté');
      else if (owned) btn = h('button.btn.sm.green', { onclick: () => g.setSkin(s.id) }, 'Porter');
      else btn = h('button.btn.sm.purple', { onclick: () => g.skinSource(s.id) }, 'Obtenir');
      return h('div.skin-card', { cls: 'r' + s.r + (owned ? '' : ' locked'), style: rr(s.r) },
        h('img', { src: ui.snaps['skin_' + s.id] || '', alt: '' }),
        h('b', null, s.name),
        h('small.bonus', null, bon),
        h('small.muted', null, owned ? 'Bonus actif (possédé)' : s.src),
        btn,
      );
    }));
  },
};

// ====================================================================== GACHA (pouvoirs / compagnons)
function gachaPanel(kind) {
  const isSkill = kind === 'skills';
  return {
    title: isSkill ? 'Pouvoirs' : 'Compagnons',
    render(ui, g) {
      const st = g.st;
      const data = st[kind];
      const list = isSkill ? SKILLS : PETS;
      const byId = isSkill ? SKILL_BY_ID : PET_BY_ID;
      const slots = isSkill ? VIP_PERKS[g.stats.vip].skillSlots : VIP_PERKS[g.stats.vip].petSlots;
      const maxSlots = isSkill ? 4 : 3;
      const res = isSkill ? 'feathers' : 'eggs';
      const pic = (x) => (isSkill ? h('span.sk-ic', { html: icon('sk_' + x.id) }) : h('img', { src: ui.snaps['pet_' + x.id] || '', alt: '' }));
      // emplacements équipés
      const eq = h('div.eq-row', null, Array.from({ length: maxSlots }, (_, i) => {
        if (i >= slots) return h('div.eq-slot.locked', { html: icon('lock') + `<small>VIP ${isSkill ? 6 : 4}</small>`, onclick: () => ui.open('shop', 'vip') });
        const id = data.equipped[i];
        if (!id) return h('div.eq-slot.empty', null, '+');
        const x = byId[id];
        return h('button.eq-slot', { cls: 'r' + x.r, style: rr(x.r), onclick: () => detail(x) }, pic(x), h('b', null, 'Nv ' + data.owned[id].lvl));
      }));
      // invocation
      const pity = isSkill ? `Légendaire garanti dans ${SKILL_PITY_LEG - data.pityLeg} · Divin garanti dans ${SKILL_PITY_DIV - data.pityDiv}` : `Légendaire garanti dans ${PET_PITY_LEG - data.pityLeg}`;
      const have = st.res[res];
      const sumBtn = (n, gems) => {
        const can = have >= n;
        return h('button.btn.summon', { cls: can ? 'green' : 'purple', onclick: () => g.summon(kind, n) },
          h('span', null, 'x' + n),
          h('small', { html: can ? icon(res) + ' ' + n : icon('gems') + ' ' + fmt(gems) }));
      };
      const freeBtn = isSkill && !st.daily.summonFree ? h('button.btn.summon.gold', { onclick: () => g.summon(kind, 1, true) }, h('span', null, 'Gratuit'), h('small', null, '1 / jour')) : null;
      const summon = h('div.summon-card', { cls: kind },
        h('div.summon-top', null,
          h('b', null, isSkill ? 'Autel des Plumes' : 'Nid Enchanté'),
          h('span.have', { html: icon(res) + ' ' + fmt(have) }),
        ),
        h('div.summon-btns', null, freeBtn, sumBtn(1, isSkill ? 100 : 80), sumBtn(10, isSkill ? 900 : 700), sumBtn(35, isSkill ? 3000 : 2400)),
        h('div.pity', null, pity),
        h('button.link', { onclick: () => odds() }, 'Voir les probabilités'),
      );
      const odds = () => {
        const o = isSkill ? SKILL_RARITY_ODDS : PET_RARITY_ODDS;
        ui.modal({ title: 'Probabilités', body: h('div.odds', null, o.map((p, r) => p ? h('div.orow', { style: { '--rc': RARITIES[r].color } }, h('i'), h('span', null, RARITIES[r].name), h('b', null, p + '%')) : null), h('p.muted.small', null, 'Chaque objet d\'une rareté a la même chance d\'apparaître.')) });
      };
      // collection
      const detail = (x) => {
        const o = data.owned[x.id];
        const lvl = o ? o.lvl : 1;
        const lines = [];
        if (isSkill) {
          if (x.mult) lines.push(`Dégâts : ${fmt(x.mult * skillLevelMult(lvl) * 100)}% ATQ${x.hits ? ` (${x.hits} coups)` : ''}`);
          if (x.heal) lines.push(`Soin : ${Math.round(x.heal * 100)}% PV`);
          if (x.shield) lines.push(`Bouclier : ${Math.round(x.shield * skillLevelMult(lvl) * 100)}% PV`);
          lines.push(`Recharge : ${x.cd} s`);
          lines.push(`Bonus possédé : +${fmt(SKILL_PASSIVE_ATK[x.r] * (1 + 0.1 * (lvl - 1)))}% ATQ`);
        } else {
          lines.push(`Attaque : ${fmt(x.mult * petLevelMult(lvl) * 100)}% ATQ toutes les 2,2 s`);
          lines.push(`Si équipé : +${fmt(PET_EQUIP_ATK[x.r] * petLevelMult(lvl))}% ATQ`);
          lines.push(`Bonus possédé : +${fmt(PET_OWN_HP[x.r] * (1 + 0.1 * (lvl - 1)))}% PV`);
        }
        const body = h('div.detail', { style: rr(x.r) },
          h('div.detail-top', { cls: 'r' + x.r }, pic(x), h('div', null, h('b', null, x.name), h('span.irar', null, RARITIES[x.r].name), h('div.muted', null, o ? `Niveau ${o.lvl}` : 'Non possédé'))),
          x.desc ? h('p', null, x.desc) : null,
          h('ul.lines', null, lines.map((l) => h('li', null, l))),
          o ? h('div.copies', null, h('span', null, `Copies ${o.copies}/${dupNeed(o.lvl)}`), h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, o.copies / dupNeed(o.lvl))})` } }))) : null,
        );
        const btns = [];
        if (o) {
          btns.push({ label: 'Améliorer', cls: o.copies >= dupNeed(o.lvl) ? 'gold' : 'gray', disabled: o.copies < dupNeed(o.lvl), fn: () => { g.levelUpEntry(kind, x.id); return false; } });
          const idx = data.equipped.indexOf(x.id);
          if (idx >= 0 && idx < slots) btns.push({ label: 'Retirer', cls: 'red', fn: () => g.unequipEntry(kind, idx) });
          else btns.push({ label: 'Équiper', cls: 'green', fn: () => g.equipEntry(kind, x.id) });
        }
        ui.modal({ title: isSkill ? 'Pouvoir' : 'Compagnon', body, buttons: btns, cls: 'r' + x.r });
      };
      const grid = h('div.coll-grid', null, list.map((x) => {
        const o = data.owned[x.id];
        const need = o ? dupNeed(o.lvl) : 1;
        return h('button.coll', { cls: 'r' + x.r + (o ? '' : ' locked') + (o && o.copies >= need ? ' can' : ''), style: rr(x.r), onclick: () => detail(x) },
          pic(x),
          h('b', null, x.name),
          o ? h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, o.copies / need)})` } }), h('small', null, `Nv ${o.lvl} · ${o.copies}/${need}`)) : h('small.muted', null, RARITIES[x.r].name),
        );
      }));
      return h('div.col', null, eq, summon, h('h4', null, 'Collection'), grid);
    },
  };
}

// ====================================================================== AVENTURE
const adventure = {
  title: 'Aventure',
  tabs: [['tower', 'Arbre à Chat'], ['dungeons', 'Donjons'], ['arena', 'Arène']],
  tabDot: (g, id) => (id === 'dungeons' ? DUNGEONS.some((d) => g.st.dungeons[d.id].keys > 0) : id === 'arena' ? g.st.arena.tickets > 0 || g.arenaDailyClaimable() : false),
  render(ui, g, tab) {
    const st = g.st;
    if (tab === 'tower') {
      const f = st.tower.floor;
      const floors = [f + 2, f + 1, f, Math.max(1, f - 1)].filter((x, i, a) => a.indexOf(x) === i);
      return h('div.col', null,
        h('div.tower', null, floors.map((x) => h('div.floor', { cls: x === f ? 'cur' : x < f ? 'done' : '' },
          h('b', null, 'Étage ' + x),
          chipsOf(ui, g, towerReward(x)),
          x === f ? h('button.btn.green', { onclick: () => g.startTower() }, 'Grimper') : x < f ? h('span.check', null, '✓') : h('span.muted', null, 'Verrouillé'),
        ))),
        h('p.muted.small.center', null, 'Chaque étage est gardé par un boss. Pas de limite de tentatives. Étage 30 : costume Flocon des Neiges !'),
      );
    }
    if (tab === 'dungeons') {
      const maxBuys = VIP_PERKS[g.stats.vip].dungeonBuys;
      return h('div.col', null, DUNGEONS.map((d) => {
        const ds = st.dungeons[d.id];
        const rew = dungeonReward(d.id, ds.lvl, st.camp.best);
        const sweepRew = ds.lvl > 1 ? dungeonReward(d.id, ds.lvl - 1, st.camp.best) : null;
        return h('div.dungeon', { style: { '--dc': d.color } },
          h('img.dg-img', { src: ui.snaps['enemy_' + d.enemy] || '', alt: '' }),
          h('div.grow', null,
            h('b', null, d.name),
            h('div.muted.small', null, `Niveau ${ds.lvl} · ${d.desc}`),
            chipsOf(ui, g, rew),
            h('div.keys', { html: icon('key') + ` ${ds.keys}/${DUNGEON_FREE_KEYS}` }),
          ),
          h('div.dg-btns', null,
            h('button.btn.sm.green', { disabled: ds.keys <= 0, onclick: () => g.startDungeon(d.id) }, 'Combattre'),
            sweepRew ? h('button.btn.sm.blue', { disabled: ds.keys <= 0, onclick: () => g.sweepDungeon(d.id) }, 'Balayer') : null,
            ds.buys < maxBuys ? h('button.btn.sm.purple', { onclick: () => g.buyDungeonKey(d.id) }, h('span', { html: '+1 ' + icon('key') }), h('small', { html: icon('gems') + ' ' + (100 * (ds.buys + 1)) })) : h('small.muted', null, `Achats max (VIP ${g.stats.vip})`),
          ),
        );
      }), h('p.muted.small.center', null, 'Clé rendue en cas de défaite. Les clés se rechargent chaque jour.'));
    }
    // arène
    const lb = g.arenaBoard();
    const me = lb.find((x) => x.me);
    const opps = g.arenaOpponents();
    return h('div.col', null,
      h('div.arena-me', null,
        h('img', { src: ui.snaps['head_' + st.skins.current] || '', alt: '' }),
        h('div.grow', null, h('b', null, `Rang #${me.rank}`), h('div.muted.small', { html: icon('power') + ' ' + fmt(g.stats.power) })),
        h('div.tickets', { html: icon('ticket') + ' ' + st.arena.tickets }),
        h('button.btn.sm.purple', { onclick: () => g.buyArenaTicket() }, '+'),
      ),
      g.arenaDailyClaimable() ? h('button.btn.gold.wide', { onclick: () => g.claimArenaDaily() }, h('span', null, 'Récompense du jour'), h('small', { html: icon('gems') + ' ' + arenaDailyGems(me.rank) + ' · ' + icon('arenaCoins') + ' ' + (300 - Math.min(250, me.rank * 4)) })) : h('p.muted.small.center', null, 'Récompense quotidienne réclamée. Revenez demain !'),
      h('h4', null, 'Adversaires'),
      opps.map((o) => h('div.opp', null,
        h('img', { src: ui.snaps['head_' + o.skin] || '', alt: '' }),
        h('div.grow', null, h('b', null, `#${o.rank} ${o.name}`), h('div.small', { html: icon('power') + ' ' + fmt(o.power) + (o.vip ? ` · <span class="vipc">VIP ${o.vip}</span>` : '') })),
        h('button.btn.sm', { cls: o.power < g.stats.power ? 'green' : 'red', disabled: st.arena.tickets <= 0, onclick: () => g.arenaFight(o.id) }, 'Défier'),
      )),
      h('h4', null, 'Classement du serveur'),
      h('div.board', null, lb.slice(0, 10).concat(me.rank > 10 ? [me] : []).map((x) => h('div.brow', { cls: (x.me ? 'me ' : '') + (x.rank <= 3 ? 'top' + x.rank : '') },
        h('b.rk', null, '#' + x.rank),
        h('img', { src: ui.snaps['head_' + x.skin] || '', alt: '' }),
        h('span.grow', null, x.name, x.vip ? h('small.vipc', null, ' VIP ' + x.vip) : null),
        h('b', { html: icon('power') + fmt(x.power) }),
      ))),
      h('h4', null, 'Boutique d\'arène', h('span.have', { html: ' ' + icon('arenaCoins') + ' ' + fmt(st.res.arenaCoins) })),
      h('div.grid2', null, ARENA_SHOP.map((a) => {
        const bought = st.arena.shop[a.id] || 0;
        const out = bought >= a.limit;
        return h('div.shop-mini', null, chipsOf(ui, g, a.rewards), h('small.muted', null, `${bought}/${a.limit}`), h('button.btn.sm', { cls: out ? 'gray' : st.res.arenaCoins >= a.cost ? 'gold' : 'gray', disabled: out, onclick: () => g.arenaShopBuy(a.id) }, h('span', { html: icon('arenaCoins') + ' ' + fmt(a.cost) })));
      })),
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
  tabs: [['offers', 'Offres'], ['gems', 'Gemmes'], ['cards', 'Cartes'], ['pass', 'Passe'], ['vip', 'VIP']],
  tabDot: (g, id) => (id === 'offers' ? !g.st.daily.freeGift : id === 'vip' ? g.vipGiftClaimable() : id === 'cards' ? g.fundClaimable() : id === 'pass' ? g.passClaimable() : false),
  render(ui, g, tab) {
    const st = g.st;
    if (tab === 'offers') {
      const flash = st.iap.flash && st.iap.flash.until > Date.now() ? st.iap.flash : null;
      return h('div.col', null,
        h('div.free-gift', { cls: st.daily.freeGift ? 'done' : '' },
          h('span', { html: icon('gift') }),
          h('div.grow', null, h('b', null, 'Cadeau gratuit du jour'), h('div.small.muted', null, '300 pelotes + 20 gemmes')),
          h('button.btn.sm', { cls: st.daily.freeGift ? 'gray' : 'green', disabled: st.daily.freeGift, onclick: () => g.claimFreeGift() }, st.daily.freeGift ? 'Reçu' : 'Gratuit'),
        ),
        flash ? h('div.flash-wrap', null, h('div.flash-title', null, h('b', null, 'OFFRE FLASH'), h('span', { dataset: { until: flash.until } })), productCard(ui, g, flash.id, { cls: 'hot' })) : null,
        !st.iap.bought.starter ? productCard(ui, g, 'starter', { cls: 'starter' }) : null,
        h('h4', null, 'Offres du jour', h('small.muted', null, ' · réinitialisées chaque jour')),
        h('div.grid3', null, ['daily_1', 'daily_2', 'daily_3'].map((id) => productCard(ui, g, id))),
        h('h4', null, 'Coffrets de la semaine'),
        h('div.grid2', null, ['weekly_1', 'weekly_2'].map((id) => productCard(ui, g, id))),
        h('h4', null, 'Packs légendaires'),
        ['ninja', 'cyber', 'whale'].map((id) => productCard(ui, g, id, { cls: 'big ' + id })),
        h('h4', null, 'Échanges contre gemmes'),
        h('div.grid2', null, g.exchanges().map((x) => h('div.shop-mini', null, chipsOf(ui, g, x.rewards), h('button.btn.sm', { cls: st.res.gems >= x.gems ? 'purple' : 'gray', onclick: () => g.exchange(x.id) }, h('span', { html: icon('gems') + ' ' + fmt(x.gems) }))))),
        h('p.legal', null, 'Achats simulés : aucun paiement réel n\'est effectué dans cette version.'),
      );
    }
    if (tab === 'gems') {
      return h('div.col', null,
        h('div.grid3', null, ['gems_1', 'gems_2', 'gems_3', 'gems_4', 'gems_5', 'gems_6'].map((id, i) => {
          const p = PRODUCTS[id];
          const first = !st.iap.bought[id];
          return h('button.gem-tile', { onclick: () => g.showProduct(id) },
            first ? h('span.x2', null, 'x2') : null,
            h('div.gem-pile', { cls: 'g' + i, html: icon('gems') }),
            h('b', null, fmt(p.gems * (first ? 2 : 1))),
            first ? h('small.muted.strike', null, fmt(p.gems)) : h('small.muted', null, 'gemmes'),
            h('span.btn.green.price', null, fmtEuro(p.price)),
          );
        })),
        h('p.muted.small.center', null, 'Premier achat de chaque palier : gemmes doublées !'),
      );
    }
    if (tab === 'cards') {
      const now = Date.now();
      const monthlyLeft = st.iap.monthlyUntil > now ? Math.ceil((st.iap.monthlyUntil - now) / 864e5) : 0;
      const fundRows = FUND_TIERS.map((f, i) => {
        const claimed = st.iap.fundClaimed.includes(i);
        const reached = st.camp.best >= f.stage;
        return h('div.fund-row', { cls: claimed ? 'done' : reached ? 'ready' : '' },
          h('span', null, `Étape ${Math.floor((f.stage - 1) / 10) + 1}-${((f.stage - 1) % 10) + 1}`),
          h('b', { html: icon('gems') + ' ' + fmt(f.gems) }),
          claimed ? h('span.check', null, '✓') : h('button.btn.sm', { cls: st.iap.fund && reached ? 'green' : 'gray', disabled: !st.iap.fund || !reached, onclick: () => g.claimFund(i) }, 'Réclamer'),
        );
      });
      return h('div.col', null,
        h('div.card-offer.monthly', null,
          h('b', null, 'Carte Mensuelle'), h('p.small', null, PRODUCTS.monthly.desc),
          monthlyLeft ? h('div.active', null, `Active — ${monthlyLeft} jours restants`) : null,
          h('button.btn.green.price', { onclick: () => g.showProduct('monthly') }, monthlyLeft ? 'Prolonger ' + fmtEuro(PRODUCTS.monthly.price) : fmtEuro(PRODUCTS.monthly.price)),
        ),
        h('div.card-offer.lifetime', null,
          h('b', null, 'Carte Royale à vie'), h('p.small', null, PRODUCTS.lifetime.desc),
          st.iap.lifetime ? h('div.active', null, 'Active pour toujours') : h('button.btn.gold.price', { onclick: () => g.showProduct('lifetime') }, fmtEuro(PRODUCTS.lifetime.price)),
        ),
        h('div.card-offer.fund', null,
          h('b', null, 'Fonds de croissance'), h('p.small', null, PRODUCTS.fund.desc),
          st.iap.fund ? h('div.active', null, 'Acheté') : h('button.btn.purple.price', { onclick: () => g.showProduct('fund') }, fmtEuro(PRODUCTS.fund.price)),
          h('div.fund-list', null, fundRows),
        ),
      );
    }
    if (tab === 'pass') {
      const tier = passTier(st);
      const xpIn = st.pass.xp - tier * PASS_XP_PER_TIER;
      return h('div.col', null,
        h('div.pass-head', null,
          h('div', null, h('b', null, 'Passe Royal'), h('div.small', null, `Palier ${tier}/30`), h('div.bar.wide', null, h('i', { style: { transform: `scaleX(${tier >= 30 ? 1 : xpIn / PASS_XP_PER_TIER})` } }))),
          st.iap.pass ? h('span.badge.gold', null, st.iap.pass === 2 ? 'DELUXE' : 'PREMIUM') : h('div.btn-col', null,
            h('button.btn.sm.gold', { onclick: () => g.showProduct('pass') }, 'Premium ' + fmtEuro(PRODUCTS.pass.price)),
            h('button.btn.sm.purple', { onclick: () => g.showProduct('pass_deluxe') }, 'Deluxe ' + fmtEuro(PRODUCTS.pass_deluxe.price)),
          ),
        ),
        h('p.muted.small', null, 'Gagnez de l\'XP de passe en ouvrant des cartons et avec les points d\'activité quotidiens. Deluxe : +10 paliers immédiats.'),
        g.passClaimable() ? h('button.btn.green.wide', { onclick: () => g.claimAllPass() }, 'Tout réclamer') : null,
        h('div.pass-list', null, PASS_TIERS.map((t) => {
          const ok = tier >= t.t;
          const cf = st.pass.free.includes(t.t), cp = st.pass.prem.includes(t.t);
          return h('div.pass-row', { cls: ok ? 'ok' : '' },
            h('b.pt', null, t.t),
            h('div.pcell', null, chipsOf(ui, g, t.free), cf ? h('span.check', null, '✓') : h('button.btn.xs', { cls: ok ? 'green' : 'gray', disabled: !ok, onclick: () => g.claimPass(t.t, false) }, 'Prendre')),
            h('div.pcell.prem', null, chipsOf(ui, g, t.prem), cp ? h('span.check', null, '✓') : h('button.btn.xs', { cls: ok && st.iap.pass ? 'gold' : 'gray', disabled: !ok || !st.iap.pass, onclick: () => g.claimPass(t.t, true) }, st.iap.pass ? 'Prendre' : h('span', { html: icon('lock') }))),
          );
        })),
      );
    }
    // VIP
    const vip = g.stats.vip;
    const pts = st.iap.vip;
    const next = VIP_THRESHOLDS[vip + 1];
    return h('div.col', null,
      h('div.vip-card', null,
        h('div.vip-big', { html: icon('crown') + `<b>VIP ${vip}</b>` }),
        next ? h('div.grow', null, h('div.small', null, `Encore ${fmtEuro(next - pts)} d'achats pour VIP ${vip + 1}`), h('div.bar.wide.gold', null, h('i', { style: { transform: `scaleX(${(pts - VIP_THRESHOLDS[vip]) / (next - VIP_THRESHOLDS[vip])})` } }))) : h('b.grow', null, 'Niveau maximum — Empereur des Chats !'),
      ),
      vip > 0 ? h('button.btn.wide', { cls: g.vipGiftClaimable() ? 'gold' : 'gray', disabled: !g.vipGiftClaimable(), onclick: () => g.claimVipGift() }, h('span', null, 'Coffre VIP quotidien'), h('small', { html: icon('gems') + ' ' + VIP_PERKS[vip].dailyGems + ' + ' + icon('yarn') + ' ' + vip * 150 })) : null,
      h('div.vip-list', null, VIP_TEXT.map((t, i) => h('div.vip-row', { cls: i === vip ? 'cur' : i < vip ? 'got' : '' },
        h('b', null, 'VIP ' + i),
        h('div.grow', null, h('div', null, t), h('small.muted', null, `ATQ/PV +${VIP_PERKS[i].stat}% · Passif +${VIP_PERKS[i].idle}% · Hors-ligne ${VIP_PERKS[i].offlineH} h`)),
        h('small.muted', null, fmtEuro(VIP_THRESHOLDS[i])),
      ))),
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
        h('div.activity', null,
          h('b', null, `Activité ${d.pts}/100`),
          h('div.act-track', null, h('i', { style: { transform: `scaleX(${Math.min(1, d.pts / 100)})` } }),
            DAILY_CHESTS.map((c, i) => h('button.act-chest', { cls: d.chests.includes(i) ? 'done' : d.pts >= c.pts ? 'ready' : '', style: { left: c.pts + '%' }, onclick: () => (d.pts >= c.pts && !d.chests.includes(i) ? g.claimChest(i) : ui.rewards(g.previewRewards(c.rewards), `Coffre ${c.pts} points`)) }, h('span', { html: icon('chest') }), h('small', null, c.pts)))),
        ),
        DAILY_QUESTS.map((q) => {
          const v = d.q[q.id] || 0;
          const done = d.qDone.includes(q.id);
          return h('div.list-row', null,
            h('div.grow', null, h('b', null, q.name), h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, v / q.goal)})` } }), h('small', null, `${Math.min(v, q.goal)}/${q.goal}`))),
            h('span.pts', null, '+' + q.pts),
            done ? h('span.check', null, '✓') : h('button.btn.sm', { cls: v >= q.goal ? 'green' : 'gray', disabled: v < q.goal, onclick: () => g.claimQuest(q.id) }, 'Valider'),
          );
        }),
      );
    }
    if (tab === 'login') {
      const L = st.login;
      const todayOk = g.loginClaimable();
      return h('div.col', null,
        h('p.muted.center', null, 'Connectez-vous 7 jours pour obtenir le costume Siamois Élégant !'),
        h('div.login-grid', null, LOGIN_CALENDAR.map((r, i) => h('div.lday', { cls: (i < L.claimed ? 'done ' : '') + (i === L.claimed && todayOk ? 'ready ' : '') + (i === 6 ? 'big' : '') },
          h('b', null, 'Jour ' + (i + 1)),
          chipsOf(ui, g, r),
          i < L.claimed ? h('span.check', null, '✓') : null,
        ))),
        h('button.btn.green.wide', { disabled: !todayOk, onclick: () => g.claimLogin() }, todayOk ? 'Récupérer' : 'Revenez demain'),
      );
    }
    return h('div.col', null, ACHIEVEMENTS.map((a) => {
      const v = g.achValue(a);
      const done = st.ach.includes(a.id);
      return h('div.list-row', { cls: done ? 'dim' : '' },
        h('div.grow', null, h('b', null, a.name), h('div.bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, v / a.goal)})` } }), h('small', null, `${fmt(Math.min(v, a.goal))}/${fmt(a.goal)}`))),
        h('span.small', { html: icon('gems') + ' ' + a.gems }),
        done ? h('span.check', null, '✓') : h('button.btn.sm', { cls: v >= a.goal ? 'green' : 'gray', disabled: v < a.goal, onclick: () => g.claimAch(a.id) }, 'Réclamer'),
      );
    }));
  },
};

// ====================================================================== PUBS (vidéos bonus simulées)
const ads = {
  title: 'Vidéos bonus',
  render(ui, g) {
    const st = g.st;
    const left = AD_LIMIT - st.daily.ads;
    return h('div.col', null,
      h('p.center', null, `Regardez une courte vidéo pour un bonus gratuit. Restantes aujourd'hui : ${left}/${AD_LIMIT}`),
      st.iap.lifetime ? h('p.center.good', null, 'Carte Royale : bonus instantanés, sans vidéo !') : null,
      h('div.grid2', null, AD_REWARDS.map((r, i) => h('div.shop-mini', null, chipsOf(ui, g, r), h('button.btn.sm', { cls: left > 0 ? 'green' : 'gray', disabled: left <= 0, onclick: () => g.watchAd(() => g.grantAd(i)) }, h('span', { html: icon('tv') + ' Regarder' }))))),
      h('p.legal', null, 'Vidéos simulées : brancher une régie publicitaire (ex. AdMob) pour la version publiée.'),
    );
  },
};

// ====================================================================== PREMIER ACHAT
const firstRecharge = {
  title: 'Bonus de premier achat',
  render(ui, g) {
    const st = g.st;
    return h('div.col.first-rech', null,
      h('div.fr-hero', null, h('b', null, 'Faites n\'importe quel achat'), h('span', null, 'et recevez en plus :')),
      chipsOf(ui, g, FIRST_RECHARGE),
      st.iap.firstRecharge === 1 ? h('button.btn.gold.wide', { onclick: () => g.claimFirstRecharge() }, 'Réclamer maintenant !')
        : h('button.btn.green.wide', { onclick: () => g.showProduct('gems_1') }, 'Dès ' + fmtEuro(99)),
      h('p.muted.small.center', null, 'Pouvoir Mythique « Laser Oculaire » + Compagnon Mythique « Dragonnet » : de quoi dominer les premiers chapitres.'),
    );
  },
};

// ====================================================================== PARAMÈTRES
const settings = {
  title: 'Paramètres',
  render(ui, g) {
    const st = g.st;
    const q = st.settings.quality;
    const tog = (k, label) => h('button.toggle', { cls: st.settings[k] ? 'on' : '', onclick: () => g.setSetting(k, !st.settings[k]) }, h('span', null, label), h('i'));
    return h('div.col', null,
      h('h4', null, 'Qualité graphique'),
      h('div.seg', null, [['auto', 'Auto'], ['high', 'Haute'], ['medium', 'Moyenne'], ['low', 'Basse']].map(([id, l]) => h('button', { cls: q === id ? 'on' : '', onclick: () => g.setSetting('quality', id) }, l))),
      h('p.muted.small', null, `FPS mesurés : ${Math.round(g.fps || 0)} · rendu ${g.world.quality}`),
      tog('sound', 'Effets sonores'),
      tog('music', 'Musique'),
      h('h4', null, 'Partie'),
      h('p.small.muted', null, `Créée le ${new Date(st.created).toLocaleDateString('fr-FR')} · ${fmt(st.stats.opens)} cartons ouverts · Dépenses simulées : ${fmtEuro(st.iap.spent)}`),
      h('button.btn.red.wide', { onclick: (e) => {
        const b = e.currentTarget;
        if (b.dataset.armed) g.resetGame();
        else { b.dataset.armed = '1'; b.firstChild.textContent = 'Toucher encore pour tout effacer'; }
      } }, h('span', null, 'Recommencer la partie')),
      h('p.legal', null, 'Miaou Empire — prototype. Achats et vidéos simulés. Probabilités affichées dans chaque écran d\'invocation et du carton.'),
    );
  },
};

export const PANELS = { hero, skills: gachaPanel('skills'), pets: gachaPanel('pets'), adventure, shop, quests, ads, firstRecharge, settings };
