// =====================================================================
//  Hôtel des ventes (inspiré de Dofus) : lots de 1/10/100, prix qui bougent
//  selon l'offre et la demande, taxe de mise en vente, ventes par d'autres
//  joueurs simulés, historique des prix + bureau de change gemmes ↔ or.
//  (Pour un vrai jeu en ligne, ce module serait remplacé par un serveur.)
// =====================================================================
import { RESOURCES, RES_BY_ID, MARKET_TAX, MARKET_LOTS, MARKET_QUICK_SELL, marketSlots } from './content.js';
import { idlePerHour, vipLevel } from './config.js';
import { dayKey, uid } from './util.js';
import { bumpQuest } from './economy.js';

const LOT_DISC = { 1: 1, 10: 0.96, 100: 0.92 };
export function marketUnit(st) { return Math.max(1, idlePerHour(st.camp.best).gold / 100); }

function baseStock(r) {
  if (r.id === 'bastetTear') return { 1: 0, 10: 0, 100: 0 };
  if (r.r >= 6) return { 1: 2, 10: 0, 100: 0 };
  if (r.r >= 4) return { 1: 6, 10: 1, 100: 0 };
  if (r.r >= 2) return { 1: 14, 10: 5, 100: 1 };
  return { 1: 25, 10: 12, 100: 4 };
}
export function ensureMarket(st) {
  if (st.market && st.market.goods) {
    for (const r of RESOURCES) if (!st.market.goods[r.id]) st.market.goods[r.id] = { idx: 1, hist: [], stock: baseStock(r) };
    return st.market;
  }
  st.market = { goods: {}, listings: [], log: [], lastTick: Date.now(), day: dayKey(), change: 1 };
  for (const r of RESOURCES) {
    const idx = 0.8 + Math.random() * 0.4;
    st.market.goods[r.id] = { idx, hist: Array.from({ length: 10 }, (_, i) => +(idx * (0.85 + Math.random() * 0.3)).toFixed(3)), stock: baseStock(r) };
  }
  // une Larme de Bastet apparaît parfois…
  if (Math.random() < 0.3) st.market.goods.bastetTear.stock[1] = 1;
  return st.market;
}

export function unitPrice(st, id, lot = 1) {
  const g = st.market.goods[id];
  return RES_BY_ID[id].v * marketUnit(st) * g.idx * (LOT_DISC[lot] || 1);
}
export function lotPrice(st, id, lot) { return Math.ceil(unitPrice(st, id, lot) * lot); }

export function buyLot(st, id, lot) {
  const g = st.market.goods[id];
  if (!g.stock[lot]) return { err: 'Aucun lot disponible' };
  const p = lotPrice(st, id, lot);
  if (st.res.gold < p) return { err: 'Pas assez d\'or' };
  st.res.gold -= p;
  st.mats[id] = (st.mats[id] || 0) + lot;
  g.stock[lot]--;
  g.idx = Math.min(3, g.idx * (1 + 0.012 * Math.sqrt(lot)));
  return { ok: true, price: p };
}

export function maxListings(st) { return marketSlots(vipLevel(st.iap.vip)); }
export function listLot(st, id, lot, total) {
  const m = st.market;
  if (m.listings.length >= maxListings(st)) return { err: 'Plus d\'emplacement de vente (VIP pour en avoir plus)' };
  if ((st.mats[id] || 0) < lot) return { err: 'Quantité insuffisante' };
  total = Math.max(1, Math.round(total));
  const tax = Math.ceil(total * MARKET_TAX);
  if (st.res.gold < tax) return { err: 'Pas assez d\'or pour la taxe' };
  st.mats[id] -= lot;
  st.res.gold -= tax;
  m.listings.push({ uid: uid(), id, lot, price: total, t: Date.now() });
  return { ok: true, tax };
}
export function cancelListing(st, luid) {
  const m = st.market;
  const i = m.listings.findIndex((l) => l.uid === luid);
  if (i < 0) return false;
  const [l] = m.listings.splice(i, 1);
  st.mats[l.id] += l.lot;
  return true;
}
export function quickSell(st, id, n) {
  if ((st.mats[id] || 0) < n || n <= 0) return 0;
  const g = Math.floor(unitPrice(st, id, 1) * n * MARKET_QUICK_SELL);
  st.mats[id] -= n;
  st.res.gold += g;
  st.market.goods[id].idx = Math.max(0.4, st.market.goods[id].idx * (1 - 0.002 * Math.sqrt(n)));
  bumpQuest(st, 'market', 1);
  return g;
}

// Fait vivre le marché : ventes des annonces, fluctuation des prix, réassort des vendeurs
export function tickMarket(st, now = Date.now()) {
  const m = ensureMarket(st);
  const dtH = Math.min(48, Math.max(0, (now - m.lastTick) / 3600000));
  if (dtH < 1 / 120) return [];
  m.lastTick = now;
  const sold = [];
  for (let i = m.listings.length - 1; i >= 0; i--) {
    const l = m.listings[i];
    const fair = unitPrice(st, l.id, l.lot) * l.lot;
    const rate = 0.55 * Math.pow(fair / l.price, 3.2) * (RES_BY_ID[l.id].r >= 5 ? 0.5 : 1);
    if (Math.random() < 1 - Math.exp(-rate * dtH)) {
      m.listings.splice(i, 1);
      st.res.gold += l.price;
      st.stats.sold++;
      bumpQuest(st, 'market', 1);
      m.goods[l.id].idx = Math.max(0.4, m.goods[l.id].idx * 0.992);
      const e = { id: l.id, lot: l.lot, price: l.price, t: now };
      m.log.unshift(e);
      sold.push(e);
    }
  }
  m.log = m.log.slice(0, 30);
  for (const r of RESOURCES) {
    const g = m.goods[r.id];
    g.idx += (1 - g.idx) * Math.min(1, 0.06 * dtH) + (Math.random() - 0.5) * 0.06 * Math.sqrt(dtH);
    g.idx = Math.max(0.45, Math.min(3, g.idx));
    const b = baseStock(r);
    for (const lot of MARKET_LOTS) if (g.stock[lot] < b[lot] && Math.random() < 1 - Math.exp(-0.5 * dtH)) g.stock[lot]++;
  }
  m.change = Math.max(0.7, Math.min(1.5, m.change + (1 - m.change) * 0.05 * dtH + (Math.random() - 0.5) * 0.04 * Math.sqrt(dtH)));
  const dk = dayKey(now);
  if (m.day !== dk) {
    m.day = dk;
    for (const r of RESOURCES) { const g = m.goods[r.id]; g.hist.push(+g.idx.toFixed(3)); if (g.hist.length > 14) g.hist.shift(); }
  }
  return sold;
}

// ---------------------------------------------------------------- bureau de change (gemmes ↔ or)
export function gemSellRate(st) { return marketUnit(st) * 2.2 * st.market.change; } // or reçu par gemme vendue
export function gemBuyRate(st) { return marketUnit(st) * 3.2 * st.market.change; } // or payé par gemme achetée
export function gemBuyLimit(st) { return 100 + vipLevel(st.iap.vip) * 20; }
export function sellGems(st, n) {
  if (st.res.gems < n || n <= 0) return 0;
  const g = Math.floor(gemSellRate(st) * n);
  st.res.gems -= n;
  st.res.gold += g;
  st.market.change = Math.max(0.7, st.market.change * (1 - 0.0004 * n));
  return g;
}
export function buyGems(st, n) {
  const left = gemBuyLimit(st) - (st.daily.changeBought || 0);
  n = Math.min(n, left);
  if (n <= 0) return { err: 'Limite quotidienne atteinte' };
  const cost = Math.ceil(gemBuyRate(st) * n);
  if (st.res.gold < cost) return { err: 'Pas assez d\'or' };
  st.res.gold -= cost;
  st.res.gems += n;
  st.daily.changeBought = (st.daily.changeBought || 0) + n;
  st.market.change = Math.min(1.5, st.market.change * (1 + 0.0004 * n));
  return { ok: true, n, cost };
}
