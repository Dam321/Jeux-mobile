// Interface des guildes : rejoindre / créer, accueil (dons, journal), boss de guilde, arbre, boutique, classements.
import { h, fmt, fmtTime } from '../util.js';
import { icon } from './icons.js';
import { VIP_PERKS } from '../config.js';
import { weekKey } from '../state.js';
import { CLASS_BY_ID } from '../classes.js';
import {
  ensureGuilds, myGuild, guildInfo, guildMembers, guildMaxMembers, guildBoard, memberBoard, guildBossOf, guildRankReward, guildLog,
  GUILD_TREE, TREE_BY_ID, FX_NAME, treeCost, GUILD_SHOP, goldDonation, GEM_DONATION, GUILD_GEM_DONATIONS, GUILD_CREATE_GEMS, GUILD_LEAVE_H,
} from '../guild.js';

const chips = (ui, g, r) => h('div.rewards.sm', null, g.previewRewards(r).map((x) => ui.rewardChip(x)));
const emblem = (color, big) => h('i.g-emblem', { cls: big ? 'big' : '', style: { '--gc': color }, html: icon('guild') });
function rankRow(r, value, extra) {
  const C = r.cls && CLASS_BY_ID[r.cls];
  return h('div.rank-row', { cls: (r.me ? 'me ' : '') + (r.rank <= 3 ? 'top' + r.rank : '') },
    h('b.rk', null, r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank),
    r.color ? emblem(r.color) : h('i.rk-cls', { style: { background: C ? C.color : '#5e45ad' } }),
    h('span.grow', null, r.name, extra ? h('small.muted', null, ' · ' + extra) : C ? h('small.muted', null, ' · ' + C.role) : null),
    h('b.rk-floor', null, value));
}

export const guildPanel = {
  title: 'Guilde',
  tabsFor: (g) => (g.st.guild.id ? [['home', 'Accueil'], ['boss', 'Boss de guilde'], ['tree', 'Arbre'], ['shop', 'Boutique'], ['rank', 'Classement']] : [['join', 'Rejoindre']]),
  tabDot: (g, id) => {
    const G = g.st.guild;
    if (id === 'home') return !G.checkin || !G.goldDon;
    if (id === 'boss') return G.tries > 0 || G.chests > 0;
    if (id === 'rank') return g.guildRankClaimable();
    return false;
  },
  render(ui, g, tab) {
    const st = g.st;
    ensureGuilds(st);
    const G = st.guild, gd = myGuild(st);
    if (!gd) return joinView(ui, g);
    const info = guildInfo(st, gd);
    const mem = guildMembers(st, gd);
    if (tab === 'home') {
      const cost = goldDonation(st);
      return h('div.col', null,
        h('div.g-head', { style: { '--gc': gd.color } }, emblem(gd.color, true),
          h('div.grow', null, h('b', null, gd.name), h('small', null, `Niveau ${info.lvl} · ${mem.count}/${guildMaxMembers(info.lvl)} membres${gd.id === 'mine' ? ' · vous êtes le chef' : ''}`),
            h('div.g-xp', null, h('i', { style: { transform: `scaleX(${info.max ? 1 : info.xp / info.next})` } }), h('span', null, info.max ? 'MAX' : `${fmt(info.xp)} / ${fmt(info.next)} XP`)))),
        h('div.res-banner', { html: `${icon('guildCoins')} ${fmt(st.res.guildCoins)} écussons · contribution ${fmt(G.contrib)}` }),
        h('h4', null, 'Chaque jour'),
        h('div.g-acts', null,
          act('Présence', '+25 écussons · +300 XP de guilde', G.checkin ? null : 'Pointer', () => g.guildCheckin(), 'green'),
          act('Don d\'or', `${fmt(cost)} or → +45 écussons · +800 XP`, G.goldDon ? null : 'Donner', () => g.guildDonateGold(), 'gold'),
          act('Don de gemmes', `${GEM_DONATION} gemmes → +100 écussons · +2000 XP (${GUILD_GEM_DONATIONS - G.gemDon} restant)`, G.gemDon < GUILD_GEM_DONATIONS ? 'Donner' : null, () => g.guildDonateGems(), 'purple', icon('gems') + ' ' + GEM_DONATION),
          act('Gardien de guilde', `${G.tries} assaut(s) restant(s) aujourd'hui`, 'Y aller', () => { ui.sheet.tab = 'boss'; ui.renderSheet(true); }, 'red'),
        ),
        h('p.small.muted', null, 'Les bonus de l\'arbre de guilde ne sont actifs que tant que vous êtes membre. La Guerre des Gouttières se joue sous les couleurs de votre guilde.'),
        h('h4', null, 'Journal'),
        h('div.g-log', null, guildLog(st).slice(0, 12).map((t) => h('p', null, t))),
        h('button.btn.red.wide', { onclick: () => g.leaveGuild() }, 'Quitter la guilde'),
      );
    }
    if (tab === 'boss') {
      const { B } = guildBossOf(weekKey());
      const boss = G.boss || { lvl: 1, hp: 1, base: 1 };
      const max = boss.base * Math.pow(1.4, boss.lvl - 1);
      const board = memberBoard(st), me = board.find((r) => r.me);
      return h('div.col', null,
        h('div.wb-head.g-boss', null, ui.monsterImg(B.boss, 2, 'wb-img'),
          h('div.grow', null, h('small', null, `GARDIEN DE GUILDE · NIVEAU ${boss.lvl}`), h('b', null, B.name),
            h('div.g-hp', null, h('i', { style: { transform: `scaleX(${Math.max(0, Math.min(1, boss.hp / max))})` } }), h('span', null, `${fmt(Math.max(0, boss.hp))} / ${fmt(max)} PV`)),
            h('p.small', null, 'PV partagés : tous les membres le frappent. Chaque Gardien vaincu donne un coffre à toute la guilde, puis un Gardien plus fort arrive.'))),
        h('div.btn-pair', null,
          h('button.btn.red', { onclick: () => g.startGuildBoss() }, h('span', null, 'Assaut (30 s)'), h('small', { html: G.tries > 0 ? `${G.tries} gratuit(s) aujourd'hui` : `${icon('gems')} ${g.guildBossBuyCost()} · max ${VIP_PERKS[g.stats.vip].dungeonBuys}/jour` })),
          h('button.btn', { cls: G.chests ? 'gold' : 'gray', disabled: !G.chests, onclick: () => g.claimGuildChests() }, h('span', null, `Coffres : ${G.chests}`), h('small', null, G.chests ? 'Récupérer' : 'Aucun pour l\'instant'))),
        h('div.wb-stats', null, stat('Votre meilleur assaut', fmt(G.best)), stat('Rang dans la guilde', me ? me.rank + 'e' : '—'), stat('Total semaine', fmt(G.total))),
        h('h4', null, 'Classement de la guilde (meilleur assaut de la semaine)'),
        h('div.rank-list', null, board.slice(0, 20).map((r) => rankRow(r, fmt(r.best), r.chief ? 'chef' : null)), me && me.rank > 20 ? [h('div.rank-gap', null, '…'), rankRow(me, fmt(me.best))] : null),
      );
    }
    if (tab === 'tree') {
      return h('div.col', null,
        h('div.res-banner', { html: `${icon('guildCoins')} ${fmt(st.res.guildCoins)} écussons de guilde · guilde niveau ${info.lvl}` }),
        GUILD_TREE.map((T) => {
          const locked = info.lvl < T.need;
          return h('div.g-tier', { cls: locked ? 'locked' : '' },
            h('h5', null, `Palier ${T.tier}`, locked ? h('small', null, ` · guilde niveau ${T.need}`) : null),
            h('div.g-nodes', null, T.nodes.map((n) => {
              const lvl = G.tree[n.id] || 0, max = lvl >= n.max, cost = treeCost(n, lvl);
              return h('div.g-node', { cls: (max ? 'max ' : '') + (lvl ? 'on' : '') },
                h('b', null, n.name),
                h('small', null, `+${+(n.per * lvl).toFixed(1)} % ${FX_NAME[n.fx]}`),
                h('div.g-pips', null, Array.from({ length: n.max }, (_, i) => h('i', { cls: i < lvl ? 'on' : '' }))),
                max ? h('span.g-max', null, 'MAX') : h('button.btn.sm', { cls: !locked && st.res.guildCoins >= cost ? 'gold' : 'gray', disabled: locked, onclick: () => g.buyGuildTree(n.id) }, h('span', null, `+${n.per} %`), h('small', { html: icon('guildCoins') + ' ' + fmt(cost) })));
            })));
        }),
      );
    }
    if (tab === 'shop') {
      return h('div.col', null,
        h('div.res-banner', { html: `${icon('guildCoins')} ${fmt(st.res.guildCoins)} écussons · limites renouvelées chaque semaine` }),
        h('div.grid2', null, GUILD_SHOP.map((it) => {
          const n = G.shop[it.id] || 0, out = n >= it.limit;
          return h('div.shop-mini', null, h('b.small', null, it.name), chips(ui, g, it.rewards), h('small.muted', null, `${n}/${it.limit}`),
            h('button.btn.sm', { cls: out ? 'gray' : st.res.guildCoins >= it.cost ? 'gold' : 'gray', disabled: out, onclick: () => g.guildShopBuy(it.id) }, h('span', { html: icon('guildCoins') + ' ' + fmt(it.cost) })));
        })),
      );
    }
    if (tab === 'rank') {
      const board = guildBoard(st), me = board.find((r) => r.me);
      return h('div.col', null,
        h('div.rank-me', null, h('b', null, `${gd.name} : ${me.rank}e`), h('span', null, `${fmt(me.score)} dégâts cette semaine`)),
        h('div.milestone', null, h('b', null, 'Récompense de la semaine (pour chaque membre)'), chips(ui, g, guildRankReward(me.rank)),
          h('button.btn', { cls: g.guildRankClaimable() ? 'gold' : 'gray', disabled: !g.guildRankClaimable(), onclick: () => g.claimGuildRank() }, g.guildRankClaimable() ? 'Récupérer' : 'Déjà récupérée cette semaine')),
        h('p.small.muted', null, 'Classement inter-guildes : dégâts cumulés de tous les membres sur leur Gardien de guilde cette semaine.'),
        h('div.rank-list', null, board.map((r) => rankRow(r, fmt(r.score), `niv. ${r.lvl} · ${r.members} membres`))),
      );
    }
    return joinView(ui, g);
  },
};

function act(title, sub, label, fn, cls, price) {
  return h('div.g-act', null, h('div.grow', null, h('b', null, title), h('small.muted', null, sub)),
    label ? h('button.btn.sm', { cls, onclick: fn }, price ? h('span', { html: price }) : h('span', null, label)) : h('span.g-done', null, 'Fait ✓'));
}
function stat(l, v) { return h('div.wb-stat', null, h('small', null, l), h('b', null, v)); }

function joinView(ui, g) {
  const st = g.st, G = st.guild;
  const board = guildBoard(st).filter((r) => r.id !== 'mine' || G.mine);
  const wait = G.leftAt + GUILD_LEAVE_H * 3600e3 - Date.now();
  const input = h('input.g-name', { type: 'text', maxlength: '24', placeholder: 'Nom de votre guilde', value: '' });
  return h('div.col', null,
    h('div.g-pitch', null, emblem('#ffcc33', true), h('div', null, h('b', null, 'Rejoignez une guilde !'),
      h('p.small', null, 'Boss de guilde à PV partagés, classements de guilde et inter-guildes, arbre de bonus permanents, boutique exclusive (aura « Étendard », cadre « Blason ») et récompenses chaque semaine.'))),
    wait > 0 ? h('p.center.small', null, `Vous pourrez rejoindre une guilde dans ${fmtTime(wait / 1000)}.`) : null,
    G.mine ? h('button.btn.gold.wide', { onclick: () => g.joinGuild('mine') }, h('span', null, `Retourner dans « ${G.mine.name} »`), h('small', null, 'Votre guilde')) : h('div.g-create', null,
      h('b', null, 'Fonder ma guilde'), input,
      h('button.btn.gold', { onclick: () => g.createGuild(input.value) }, h('span', null, 'Fonder'), h('small', { html: icon('gems') + ' ' + GUILD_CREATE_GEMS }))),
    h('h4', null, 'Guildes qui recrutent'),
    h('div.rank-list', null, board.map((r) => h('div.rank-row.g-row', null,
      h('b.rk', null, r.rank), emblem(r.color),
      h('span.grow', null, r.name, h('small.muted', null, ` · niv. ${r.lvl} · ${r.members} membres`)),
      h('button.btn.sm.green', { onclick: () => g.joinGuild(r.id) }, 'Rejoindre')))),
  );
}
