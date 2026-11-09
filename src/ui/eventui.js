// Interface du Festival de la semaine et du Bestiaire.
import { h, fmt } from '../util.js';
import { icon } from './icons.js';
import { PRODUCTS } from '../config.js';
import { weekKey } from '../state.js';
import {
  festivalOf, EVENT_RULES, EVENT_MILESTONES, EVENT_SHOP, ensureEvent, weekEnd,
  BESTIARY_TIERS, BESTIARY_BOSS_TIERS, BESTIARY_PCT, tiersOf,
} from '../event.js';
import { MONSTER_KINDS, BOSS_KIND_LIST, monsterInfo } from '../gfx/bestiary.js';
import { altarCost, altarCostN, altarMilestone, ALTAR_PCT } from '../altar.js';

// Autel de Bastet : progression infinie en gemmes
export const altarPanel = {
  title: 'Autel de Bastet',
  render(ui, g) {
    const st = g.st, A = st.altar, lvl = A.lvl || 0;
    const c1 = altarCost(lvl), c10 = altarCostN(lvl, 10);
    let next = lvl + 1; while (!altarMilestone(next)) next++;
    return h('div.col', null,
      h('div.altar', null,
        h('div.altar-glow'), h('div.altar-statue', { html: icon('altar') }),
        h('div.altar-txt', null, h('small', null, 'NIVEAU'), h('b', null, lvl), h('em', null, `+${lvl * ALTAR_PCT} % ATQ et PV pour toujours`))),
      h('p.small.center', null, 'Offrez des gemmes à Bastet : chaque niveau donne +1 % d\'ATQ et +1 % de PV, sans limite. Tous les 10 niveaux, un trésor (clé de relique + fragments d\'artefact).'),
      h('div.btn-pair', null,
        h('button.btn.gold', { onclick: () => g.altarOffer(1) }, h('span', null, 'Offrande'), h('small', { html: icon('gems') + ' ' + fmt(c1) })),
        h('button.btn.purple', { onclick: () => g.altarOffer(10) }, h('span', null, 'x10'), h('small', { html: icon('gems') + ' ' + fmt(c10) }))),
      h('div.milestone', null, h('b', null, `Prochain trésor : niveau ${next}`), chips(ui, g, altarMilestone(next))),
      h('p.small.muted.center', null, `Vos gemmes : ${fmt(st.res.gems)} · le coût augmente de 7,5 % par niveau`),
    );
  },
};

const chips = (ui, g, r) => h('div.rewards.sm', null, g.previewRewards(r).map((x) => ui.rewardChip(x)));

export const eventPanel = {
  title: 'Festival',
  tabs: [['main', 'Paliers'], ['shop', 'Boutique']],
  tabDot: (g, id) => id === 'main' && g.eventDot(),
  render(ui, g, tab) {
    const st = g.st;
    ensureEvent(st);
    const F = festivalOf(weekKey()), E = st.event;
    const head = h('div.ev-head', { style: { '--ec': F.color, '--ea': F.accent } },
      h('i.ev-ic', { html: icon('fest') }),
      h('div.grow', null, h('small', null, 'ÉVÉNEMENT DE LA SEMAINE'), h('b', null, F.name), h('p.small', null, F.desc),
        h('span.ev-timer', null, 'Se termine dans ', h('b', { dataset: { until: weekEnd() } }))),
    );
    if (tab === 'shop') {
      return h('div.col', null, head,
        h('div.res-banner', { html: `${icon('fest')} ${fmt(st.res.fest)} lanternes · elles disparaissent à la fin de la semaine` }),
        h('div.grid2', null, EVENT_SHOP.map((it) => {
          const n = E.shop[it.id] || 0, out = n >= it.limit;
          return h('div.shop-mini', null, h('b.small', null, it.name), chips(ui, g, it.rewards), h('small.muted', null, `${n}/${it.limit}`),
            h('button.btn.sm', { cls: out ? 'gray' : st.res.fest >= it.cost ? 'gold' : 'gray', disabled: out, onclick: () => g.eventShopBuy(it.id) }, h('span', { html: icon('fest') + ' ' + it.cost })));
        })),
      );
    }
    const top = EVENT_MILESTONES[EVENT_MILESTONES.length - 1].pts;
    const P = PRODUCTS.festival, bought = st.iap.weekly && st.iap.weekly.festival;
    return h('div.col', null, head,
      h('div.ev-prog', null, h('b', null, `${fmt(E.pts)} points`), h('div.ev-bar', null, h('i', { style: { transform: `scaleX(${Math.min(1, E.pts / top)})` } }),
        EVENT_MILESTONES.map((m) => h('em', { cls: E.pts >= m.pts ? 'on' : '', style: { left: (m.pts / top) * 100 + '%' } })))),
      g.eventDot() ? h('button.btn.gold.wide', { onclick: () => g.claimAllEvent() }, 'Tout récupérer') : null,
      h('div.ev-ms', null, EVENT_MILESTONES.map((m, i) => {
        const ok = E.pts >= m.pts, got = E.claimed.includes(i);
        return h('div.loyal-row', { cls: got ? 'done' : ok ? 'ready' : '' }, h('b.lv', null, m.pts),
          chips(ui, g, m.rewards),
          got ? h('span.g-done', null, '✓') : h('button.btn.sm', { cls: ok ? 'gold' : 'gray', disabled: !ok, onclick: () => g.claimEvent(i) }, ok ? 'Prendre' : '🔒'));
      })),
      !bought ? h('button.btn.purple.wide', { onclick: () => g.showProduct('festival') }, h('span', null, P.name), h('small', null, `${(P.price / 100).toFixed(2).replace('.', ',')} € · +300 points, 300 gemmes, 5 paniers`)) : null,
      h('h4', null, 'Comment gagner des points'),
      h('div.ev-rules', null, Object.values(EVENT_RULES).map((R) => h('div', null, h('span', null, R.label), h('b', null, `+${R.pts} / ${R.unit}`)))),
    );
  },
};

export const bestiaryPanel = {
  title: 'Bestiaire',
  render(ui, g) {
    const st = g.st;
    const pend = g.bestiaryPending().length;
    let total = 0;
    const card = (kind, boss) => {
      const n = st.bestiary[kind] || 0;
      const T = boss ? BESTIARY_BOSS_TIERS : BESTIARY_TIERS;
      const t = tiersOf(n, boss);
      total += t;
      const next = T[t];
      return h('div.bst-card', { cls: (n ? '' : 'unseen') + (boss ? ' boss' : '') },
        ui.monsterImg(kind, 0, 'bst-img' + (n ? '' : ' silhouette')),
        h('b', null, n ? monsterInfo(kind).name : '???'),
        h('div.bst-stars', null, T.map((_, i) => h('i', { cls: i < t ? 'on' : '' }))),
        h('small', null, next ? `${fmt(n)} / ${fmt(next)}` : `${fmt(n)} · MAX`));
    };
    const normal = MONSTER_KINDS.map((k) => card(k, false));
    const bosses = BOSS_KIND_LIST.map((k) => card(k, true));
    return h('div.col', null,
      h('div.res-banner', null, `Paliers de chasse : ${total} → +${(total * BESTIARY_PCT).toFixed(1)} % ATQ et PV pour toujours`),
      pend ? h('button.btn.gold.wide', { onclick: () => g.claimBestiary() }, h('span', null, `Récupérer ${pend} récompense(s)`)) : null,
      h('p.small.muted', null, `Chaque espèce a 4 paliers (monstres : ${BESTIARY_TIERS.join(' / ')} ; boss : ${BESTIARY_BOSS_TIERS.join(' / ')}). Chaque palier donne +${BESTIARY_PCT} % ATQ et PV, plus de l'or et des gemmes.`),
      h('h4', null, `Boss (${BOSS_KIND_LIST.length})`), h('div.bst-grid', null, bosses),
      h('h4', null, `Monstres (${MONSTER_KINDS.length})`), h('div.bst-grid', null, normal),
    );
  },
};
