// =====================================================================
//  Combat 2D temps réel (vue de côté) : campagne, donjons, tour, arène,
//  Guerre des Gouttières. Deux camps : 0 = Minou + chatons, 1 = ennemis
//  (ou chat rival + ses chatons en PvP).
// =====================================================================
import { CatRig } from './gfx/cat.js';
import { monsterSprite, monsterInfo } from './gfx/bestiary.js';
import { KittenRig } from './gfx/kittens.js';
import { buildScenery, drawScenery, drawSceneryFront } from './gfx/scenery.js';
import { FX } from './gfx/fx.js';
import { GROUND_Y, drawSprite, ell, rgba, glow, OUT } from './gfx/draw.js';
import { classFinisher, classAura, drawClassSigil, drawMarks, poisonFx, parryFx, shieldFx, executeFx, soulTo } from './gfx/classfx.js';
import { castSkill, kittenAttack, heroBasicAttack, heroFinisher, meleeImpactFx, enemyAttack, hurtFx, bossSkill, auraTick } from './gfx/skills.js';
import { hitDamage, attackInterval } from './combat.js';
import { ENEMY_RANGED, ELEMENTS } from './content.js';
import { AURA_BY_ID, KITTEN_ATTACKS } from './content3.js';
import { fmt } from './util.js';
import { sfx } from './audio.js';

const HERO_X = 100;
const KIT_OFF = [[-36, 10], [-60, -6], [-84, 8], [-14, 18], [-106, -2]]; // tous derrière le héros, en éventail
const HERO_SCALE = 0.62, KIT_SCALE = 0.5, MOB_SCALE = 0.62;
const AMBIENT = {
  petals: ['#ffb3d1', '#ffffff'], leaves: ['#ff8c2b', '#ffc23d', '#e85a1f'], bubbles: ['#bff4ff'], snow: ['#ffffff'],
  fireflies: ['#ff4fd8', '#3ff5ff', '#ffe14d'], embers: ['#ff7a2f', '#ffd23f'], stars: ['#ffffff', '#c77dff'], rain: ['#9fc6e8'],
};

const rigCache = new Map();
function rigFor(key, make) {
  if (!rigCache.has(key)) { rigCache.set(key, make()); if (rigCache.size > 60) rigCache.delete(rigCache.keys().next().value); }
  return rigCache.get(key);
}

export class Battle {
  constructor(stage, game) {
    this.stage = stage;
    this.game = game;
    this.fx = new FX();
    this.units = [];
    this.timers = [];
    this.speed = 1;
    this.phase = 'idle';
    this.phaseT = 0;
    this.scroll = 0;
    this.flashA = 0; this.flashC = '#ffffff';
    this.stopT = 0;
    this.wave = 0;
    this.time = 0;
  }

  setScenery(id, seed = 1, variant = 0) {
    const key = id + ':' + seed + ':' + variant;
    if (this.sceneKey === key) return;
    this.sceneKey = key;
    this.sc = buildScenery(id, seed, this.stage.quality === 'low' ? 1.5 : 2, variant);
  }
  get viewW() { return this.stage.viewW; }
  heroX() { return Math.max(HERO_X, Math.min(160, this.viewW * 0.3)); }

  // ------------------------------------------------------------- création des unités
  makeHero(def, side) {
    const key = JSON.stringify([def.appearance, def.gear]);
    const rig = rigFor(key, () => new CatRig(def.appearance, def.gear));
    const u = {
      side, kind: 'hero', rig, x: side ? this.viewW - this.heroX() : this.heroX(), y: GROUND_Y, facing: side ? -1 : 1, scale: HERO_SCALE, atkCount: 0, aura: AURA_BY_ID[def.aura] || null,
      stats: def.stats, hp: def.stats.hp, maxHp: def.stats.hp, shield: 0, atkT: 0.3, anim: 'idle', animK: 0, flash: 0,
      dead: false, deadT: 0, stun: 0, buff: 0, buffT: 0, name: def.name || 'Minou', style: rig.style, weaponColor: def.weaponColor || '#ffffff',
      skills: def.skills || [], cds: (def.skills || []).map((s) => s.cd * 0.35), perks: def.perks || {}, revived: false, dash: 0, height: (rig.height || 128) * HERO_SCALE,
      mech: def.mech || null, souls: 0, shT: def.mech && def.mech.shieldEvery ? def.mech.shieldEvery - 1 : 0, vanish: 0,
    };
    if (u.mech && !(def.gear && def.gear.weapon)) u.style = u.mech.style;
    u.kittens = (def.kittens || []).map((k, i) => this.makeKitten(k, u, i));
    return u;
  }
  makeKitten(k, owner, i) {
    const rig = rigFor('k_' + k.id, () => new KittenRig(k.id));
    const off = KIT_OFF[i % KIT_OFF.length];
    return {
      side: owner.side, kind: 'kitten', rig, owner, id: k.id, el: k.el, r: k.r, mult: k.mult, name: k.name, atk: KITTEN_ATTACKS[k.id] || { name: k.name, pattern: 'orb', shape: 'star', n: 1 },
      ox: off[0], oy: off[1], x: owner.x + off[0] * owner.facing, y: GROUND_Y + off[1], facing: owner.facing, scale: KIT_SCALE,
      t: 1 + i * 0.6, ultT: 8 + i * 2, anim: 'idle', animK: 0, flash: 0, height: (rig.height || 80) * KIT_SCALE, dead: false,
    };
  }
  makeEnemy(d, i, n) {
    const boss = d.boss, elite = d.elite;
    const kind = boss && d.bossKind ? d.bossKind : d.kind;
    const sc = MOB_SCALE * (elite ? 1.22 : 1) * (d.giant ? 1.5 : 1);
    const hx = this.heroX();
    const slotX = boss && n <= 2 && i === 0 ? hx + 120 : hx + 74 + i * 30;
    const info = monsterInfo(kind);
    const M = this.mods;
    const hp = d.hp * (M.enemyHp || 1) * (d.giant ? 6 : 1);
    return {
      side: 1, kind: 'enemy', ekind: kind, variant: this.enc.variant || 0, def: d, x: this.viewW + 30 + i * 36, tx: Math.min(slotX, this.viewW - 40), y: GROUND_Y + (i % 2 ? -6 : 6),
      facing: -1, scale: sc, stats: { atk: d.atk * (d.giant ? 3 : 1), def: d.def * (M.enemyDef || 1), crit: 0, critDmg: 50, dodge: 0 }, hp, maxHp: hp, atkT: d.interval * (0.3 + Math.random() * 0.5),
      interval: d.interval / (M.enemySpd || 1), anim: 'run', animK: 0, flash: 0, dead: false, deadT: 0, stun: 0, boss, elite, name: d.name, arrived: false,
      height: info.h * sc, fly: !!info.fly, ranged: ENEMY_RANGED[d.kind] || null, t: Math.random() * 10, skT: 4, enraged: false, bossSkill: d.skill || null,
    };
  }

  setPlayer(def) {
    this.playerDef = def;
    const h = this.hero;
    if (!h) return;
    const key = JSON.stringify([def.appearance, def.gear]);
    h.rig = rigFor(key, () => new CatRig(def.appearance, def.gear));
    h.style = h.rig.style;
    h.weaponColor = def.weaponColor;
    const ratio = h.maxHp ? h.hp / h.maxHp : 1;
    h.stats = def.stats; h.maxHp = def.stats.hp; h.hp = Math.max(1, Math.min(h.maxHp, ratio * h.maxHp));
    h.perks = def.perks || {};
    h.mech = def.mech || null;
    if (h.mech && !(def.gear && def.gear.weapon)) h.style = h.mech.style;
    const old = Object.fromEntries(h.skills.map((s, i) => [s.id, h.cds[i]]));
    h.skills = def.skills; h.cds = def.skills.map((s) => old[s.id] ?? s.cd * 0.4);
    const ids = def.kittens.map((k) => k.id).join();
    if (ids !== h.kittens.map((k) => k.id).join()) {
      this.units = this.units.filter((u) => !(u.kind === 'kitten' && u.owner === h));
      h.kittens = def.kittens.map((k, i) => this.makeKitten(k, h, i));
      this.units.push(...h.kittens);
    } else h.kittens.forEach((k, i) => { k.mult = def.kittens[i].mult; });
  }

  // ------------------------------------------------------------- rencontres
  start(enc) {
    this.enc = enc;
    this.mode = enc.mode;
    this.mods = {};
    for (const m of enc.mods || []) for (const k in m) if (!['id', 'name', 'desc'].includes(k)) this.mods[k] = typeof m[k] === 'number' && typeof this.mods[k] === 'number' ? this.mods[k] * m[k] : m[k];
    if (this.mods.timer) enc.timeLimit = this.mods.timer;
    this.timers = [];
    this.fx.clear();
    this.wave = 0;
    this.units = [];
    const keepHp = enc.keepHp && this.hero && !this.hero.dead ? this.hero.hp / this.hero.maxHp : 1;
    const pdef = { ...this.playerDef };
    const M = this.mods;
    if (M.heroAtk || M.heroHp || M.lifesteal || enc.reviveBuff) pdef.stats = { ...pdef.stats, atk: pdef.stats.atk * (M.heroAtk || 1) * (1 + (enc.reviveBuff || 0)), hp: pdef.stats.hp * (M.heroHp || 1), lifesteal: (pdef.stats.lifesteal || 0) + (M.lifesteal || 0) };
    if (M.noSkills) pdef.skills = [];
    if (M.noKittens) pdef.kittens = [];
    else if (M.kitMult) pdef.kittens = pdef.kittens.map((k) => ({ ...k, mult: k.mult * M.kitMult }));
    this.hero = this.makeHero(pdef, 0);
    this.hero.hp = this.hero.maxHp * keepHp;
    this.units.push(this.hero, ...this.hero.kittens);
    this.rival = null;
    if (enc.rival) {
      this.rival = this.makeHero(enc.rival, 1);
      this.units.push(this.rival, ...this.rival.kittens);
      this.setPhase('intro');
      sfx('thunder');
    } else this.setPhase('walk');
    this.game.onEncounterStart && this.game.onEncounterStart(enc);
  }
  setPhase(p) { this.phase = p; this.phaseT = 0; }
  summonMinions(boss, n = 2) {
    const kinds = this.enc.minions || ['rat'];
    for (let i = 0; i < n; i++) {
      const d = { kind: kinds[i % kinds.length], hp: boss.maxHp / 14, atk: boss.stats.atk / 3, def: boss.stats.def / 2, interval: 1.5, name: null };
      const e = this.makeEnemy(d, 1 + i, 3);
      // les sbires sortent du boss et se placent devant lui, sans dépasser la ligne de front
      const [L] = this.extent(e);
      e.x = boss.x + 30 + i * 20; e.tx = Math.max(this.heroFront() + 48 + L * 0.85 + i * 20, boss.x - 46 - i * 24); e.y = GROUND_Y + (i ? -8 : 8);
      this.units.push(e);
      this.fx.burst(e.x, e.y - 20, { count: 16, color: ['#b968ff', '#ffffff'], speed: 120, size: 8, life: 0.5, shape: 'smoke' });
    }
  }
  // Largeur réelle d'un ennemi autour de son ancre : [gauche, droite] en unités
  extent(e) {
    const spr = monsterSprite(e.ekind, 0, e.variant);
    if (!spr) return [30 * e.scale, 30 * e.scale];
    return [Math.max(12, -spr.x0) * e.scale, Math.max(12, spr.x0 + spr.w) * e.scale];
  }
  // Bord avant du héros (arme comprise) : les ennemis ne le franchissent jamais
  heroFront() { return this.heroX() + 42; }
  // Formation : un espace libre devant le héros (on y voit les sorts), puis les ennemis côte à côte
  layoutWave(list) {
    if (!list.length) return;
    const GAP = 48;
    const ext = list.map((e) => this.extent(e));
    const xs = [];
    let x = this.heroFront() + GAP;
    list.forEach((e, i) => {
      const [L] = ext[i];
      x += i === 0 ? L * 0.85 : ext[i - 1][1] * 0.5 + L * 0.5 + 4;
      xs.push(x);
    });
    // trop large pour l'écran : on resserre l'arrière de la formation, jamais le premier rang
    const n = list.length - 1, maxR = this.viewW - 6;
    const right = xs[n] + ext[n][1] * 0.7;
    if (n > 0 && right > maxR) {
      const k = Math.max(0.3, (maxR - ext[n][1] * 0.7 - xs[0]) / (xs[n] - xs[0]));
      for (let i = 1; i <= n; i++) xs[i] = xs[0] + (xs[i] - xs[0]) * k;
    }
    list.forEach((e, i) => { e.tx = xs[i]; e.x = Math.max(e.x, xs[i] + 24); });
  }
  spawnWave() {
    const defs = this.enc.waves[this.wave];
    // les tireurs restent derrière les combattants au corps à corps
    const made = defs.map((d, i) => this.makeEnemy(d, i, defs.length));
    const order = made.slice().sort((a, b) => (a.ranged ? 1 : 0) - (b.ranged ? 1 : 0));
    this.layoutWave(order);
    this.units.push(...made);
    const boss = defs.find((d) => d.boss);
    this.game.onBoss && this.game.onBoss(boss ? { name: boss.name || 'Boss' } : null);
    if (boss) { sfx('thunder'); this.flash('#ff2a3d', 0.25); this.shake(0.6); this.game.onBossIntro && this.game.onBossIntro(boss, this.enc.variant || 0); }
  }

  // ------------------------------------------------------------- API pour les effets
  foes(u) {
    const side = u.side;
    const a = this.units.filter((x) => x.side !== side && !x.dead && x.kind !== 'kitten' && (x.kind !== 'enemy' || x.arrived));
    const ux = u.x;
    a.sort((p, q) => Math.abs(p.x - ux) - Math.abs(q.x - ux));
    return a;
  }
  later(t, fn) { this.timers.push({ t, fn }); }
  shake(a) { this.stage.shake = Math.max(this.stage.shake, a); }
  flash(c, a) { this.flashC = c; this.flashA = Math.max(this.flashA, a); }
  zoom(z, x, y) { this.stage.zoom = Math.max(this.stage.zoom, z); if (x != null) this.stage.focus = [x, y]; }
  stop(t) { this.stopT = Math.max(this.stopT, t); }
  center(u) { const h = u.height * (u.kind === 'kitten' ? 1 : 1); return [u.x + (u.dash || 0) * u.facing, u.y - h * (u.kind === 'enemy' ? 0.45 : 0.42)]; }
  head(u) { if (u.kind === 'enemy') return this.center(u); const [ex, ey] = u.rig.eyePos; return [u.x + ((u.dash || 0) + ex * u.scale) * u.facing, u.y + ey * u.scale]; }
  hand(u) { const [hx, hy] = u.rig.handPos; return [u.x + ((u.dash || 0) + hx * u.scale) * u.facing, u.y + hy * u.scale]; }
  say(u, txt, style) { const [x] = this.center(u); this.fx.text(x, u.y - u.height - 18, txt, style); }
  cutin(u, sk) { if (u.side === 0 && this.game.onCutin) this.game.onCutin(sk); }
  heal(u, pct, silent) {
    const amt = u.maxHp * pct;
    u.hp = Math.min(u.maxHp, u.hp + amt);
    if (!silent) this.fx.text(u.x, u.y - u.height - 6, '+' + fmt(amt), 'heal');
  }
  shield(u, pct) { u.shield = u.maxHp * pct; }
  buff(u, v, d) { u.buff = v; u.buffT = d; }

  // dégâts : att = unité qui attaque (héros, ennemi) ; tgt = cible
  hit(att, tgt, mult, o = {}) {
    if (!tgt || tgt.dead || !att) return null;
    const S = att.stats;
    const T = tgt.stats;
    if (tgt.kind === 'hero' && o.basic && Math.random() * 100 < (T.dodge || 0)) { this.say(tgt, 'ESQUIVE', 'miss'); return null; }
    // Fine Lame Royale : parade + riposte
    const TM = tgt.mech;
    if (TM && TM.parry && o.basic && att.kind === 'enemy' && !tgt.dead && Math.random() * 100 < TM.parry) {
      this.say(tgt, 'PARADE', 'tag'); parryFx(this, tgt);
      this.later(0.1, () => { if (!att.dead && !tgt.dead) { this.hit(tgt, att, 1, {}); meleeImpactFx(this, tgt, att, false); } });
      return null;
    }
    const AM = att.kind === 'hero' ? att.mech : null;
    let dmg = hitDamage(S.atk * (1 + (att.buff || 0)), T.def || 0) * mult;
    let crit = false;
    const forceCrit = AM && AM.firstCrit && o.basic && tgt.kind === 'enemy' && !tgt.hitOnce;
    if (forceCrit) tgt.hitOnce = true;
    if (!o.noCrit && (forceCrit || Math.random() * 100 < (S.crit || 0))) { crit = true; dmg *= 1 + (S.critDmg || 50) / 100; }
    if (AM) {
      if (AM.rage) dmg *= 1 + (AM.rage / 100) * (1 - att.hp / att.maxHp);
      if (AM.soulAtk && att.souls) dmg *= 1 + (att.souls * AM.soulAtk) / 100;
    }
    if (tgt.curse && att.side === 0) dmg *= 1 + (tgt.curse * tgt.curseP) / 100;
    if (o.skill && !o.pet) dmg *= 1 + (S.skillDmg || 0) / 100;
    if ((tgt.boss || tgt.kind === 'hero') && att.kind === 'hero') dmg *= 1 + (S.bossDmg || 0) / 100;
    dmg *= 0.92 + Math.random() * 0.16;
    if (tgt.shield > 0) { const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a; }
    tgt.hp -= dmg;
    tgt.flash = 1; tgt.flashColor = crit ? '#ffe08a' : tgt.side === 0 ? '#ff4d5e' : '#ffffff';
    if (tgt.anim !== 'attack' && tgt.anim !== 'cast' && tgt.kind !== 'kitten') { tgt.anim = 'hurt'; tgt.animK = 0; }
    const [x] = this.center(tgt);
    const ty = tgt.y - tgt.height * 0.8;
    if (dmg > 0) this.fx.text(x, ty, fmt(dmg), tgt.side === 0 ? (crit ? 'hurt' : 'hurt') : crit ? 'crit' : o.pet ? 'pet' : o.skill ? 'skill' : 'dmg');
    if (crit && tgt.side === 1) { this.shake(0.25); this.stop(0.035); }
    if (o.basic && att.kind === 'hero' && S.lifesteal > 0) this.heal(att, (dmg * S.lifesteal) / 100 / att.maxHp, true);
    if (o.basic && att.kind === 'hero' && Math.random() * 100 < (S.stun || 0) && !tgt.boss) { tgt.stun = 1.2; this.say(tgt, 'ÉTOURDI', 'tag'); }
    if (tgt.side === 0) hurtFx(this, tgt);
    if (AM && o.basic && tgt.kind === 'enemy' && !tgt.dead) {
      if (AM.curse) { tgt.curse = Math.min(AM.curseMax, (tgt.curse || 0) + 1); tgt.curseP = AM.curse; }
      if (AM.poison) { tgt.poison = Math.min(AM.poisonMax, (tgt.poison || 0) + 1); tgt.poisonT = AM.poisonDur; tgt.poisonDps = hitDamage(S.atk, T.def || 0) * AM.poison; tgt.poisonSrc = att; }
      if (AM.execute && !tgt.boss && tgt.hp > 0 && tgt.hp < tgt.maxHp * AM.execute) { executeFx(this, tgt); this.say(tgt, 'EXÉCUTION', 'tag'); tgt.hp = 0; }
    }
    if (tgt.kind === 'hero' && o.basic && !tgt.dead && Math.random() * 100 < (T.counter || 0)) {
      this.later(0.12, () => { if (!att.dead && !tgt.dead) { this.say(tgt, 'RIPOSTE', 'tag'); this.hit(tgt, att, 1, {}); meleeImpactFx(this, tgt, att, false); } });
    }
    if (tgt.hp <= 0) this.kill(tgt);
    return { dmg, crit };
  }
  kill(u) {
    if (u.kind === 'hero' && u.perks.revive && !u.revived) {
      u.revived = true; u.hp = u.maxHp * 0.5;
      this.fx.pillar(u.x, { color: '#ffb52e', width: 50, dur: 1.2, y: u.y });
      this.fx.burst(u.x, u.y - 60, { count: 60, color: ['#ffd23f', '#ff7a1a', '#ffffff'], speed: 200, up: 120, size: 10, life: 1.1, shape: 'star' });
      this.say(u, 'RENAISSANCE !', 'big'); sfx('legendary');
      return;
    }
    u.dead = true; u.hp = 0;
    u.anim = 'dead'; u.animK = 0; u.deadT = 0;
    const [x, y] = this.center(u);
    if (u.kind === 'enemy') {
      this.fx.burst(x, y, { count: u.boss ? 70 : 22, color: ['#ffffff', '#ffe08a', '#d8d0ff'], speed: u.boss ? 320 : 180, size: u.boss ? 12 : 8, life: 0.6, up: 60 });
      this.fx.burst(x, y, { count: 8, color: '#ffd23f', speed: 140, size: 8, life: 0.9, shape: 'star', gravity: 300, up: 120 });
      this.fx.burst(x, u.y - 10, { count: 6, color: '#d8d0ff', speed: 40, size: 18, endSize: 34, life: 0.8, shape: 'smoke' });
      if (u.boss) { this.shake(1.2); this.flash('#ffffff', 0.5); this.fx.ring(x, u.y, { r1: 160, color: '#ffd23f' }); this.stop(0.12); this.zoom(1.08, x, y); }
      this.game.onKill && this.game.onKill(u, this.stage.toCss(x, y));
      // Seigneur des Âmes : chaque ennemi vaincu nourrit le héros
      const H = this.hero, HM = H && H.mech;
      if (HM && HM.soulHeal && !H.dead) { soulTo(this, x, y, H, HM.color); this.later(0.6, () => { if (H.dead) return; H.souls = Math.min(HM.soulMax, (H.souls || 0) + 1); this.heal(H, HM.soulHeal, true); }); }
      sfx('coin');
    } else if (u.kind === 'hero') {
      this.fx.burst(x, y, { count: 40, color: ['#ffffff', '#ffd6f5'], speed: 200, size: 9, life: 0.8, shape: 'star' });
      sfx(u.side === 0 ? 'defeat' : 'victory');
      if (u.side === 0) this.setPhase('defeat');
      else { this.shake(1); this.stop(0.15); this.zoom(1.1, x, y); }
    }
  }

  // ------------------------------------------------------------- IA des héros (joueur et rival)
  heroAct(u, dt) {
    if (u.dead) return;
    if (u.aura) auraTick(this, u, dt);
    const M = u.mech;
    if (M) {
      classAura(this, u, dt);
      if (u.vanish > 0) u.vanish -= dt;
      if (M.shieldEvery) { u.shT += dt; if (u.shT >= M.shieldEvery) { u.shT = 0; this.shield(u, M.shieldPct); shieldFx(this, u, M.color); this.say(u, 'REMPART', 'tag'); } }
    }
    if (u.buffT > 0) { u.buffT -= dt; if (u.buffT <= 0) u.buff = 0; if (Math.random() < 0.25) { const [x, y] = this.center(u); this.fx.emit(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 50, 0, -40, '#ffd23f', 7, 0.6, { shape: 'star' }); } }
    if (u.stun > 0) { u.stun -= dt; return; }
    const foes = this.foes(u);
    if (!foes.length) return;
    const tg = foes[0];
    const S = u.stats;
    u.atkT += dt;
    const iv = attackInterval(S);
    if (u.atkT >= iv && u.anim !== 'cast') {
      u.atkT = 0;
      u.anim = 'attack'; u.animK = 0;
      const melee = u.style === 'slash' || u.style === 'smash';
      if (melee && this.rival) u.dashTo = Math.max(0, Math.abs(tg.x - u.x) - 70);
      const strike = (target, second) => {
        if (!target || target.dead) { target = this.foes(u)[0]; if (!target) return; }
        const r = this.hit(u, target, 1, { basic: true });
        if (melee || u.style === 'pierce') meleeImpactFx(this, u, target, r && r.crit);
        // Maître de la Volée : un second ennemi est touché
        if (M && M.multishot && !second) { const o2 = this.foes(u).find((e) => e !== target); if (o2) { const [hx, hy] = this.hand(u); this.fx.projectile([hx, hy], () => this.center(o2), { dur: 0.22, arc: 10, draw: (ctx, px, py, a) => { ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.strokeStyle = M.accent; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.restore(); }, onHit: () => { if (!o2.dead) this.hit(u, o2, M.multishot, { basic: true, extra: true }); } }); } }
        if (r && r.crit) sfx('crit'); else sfx('hit');
        if (!second && u.perks.double && Math.random() < 0.12) this.later(0.12, () => { this.say(u, 'DOUBLE !', 'tag'); strike(target, true); });
        if (!second && Math.random() * 100 < (S.combo || 0)) this.later(0.16, () => { this.say(u, 'COMBO', 'tag'); strike(target, true); });
      };
      u.atkCount = (u.atkCount || 0) + 1;
      if (M && u.atkCount % M.ultEvery === 0) classFinisher(this, u, tg, M, (target, mult) => this.hit(u, target, mult, { basic: true, ult: true }));
      else if (!M && u.atkCount % 5 === 0) heroFinisher(this, u, tg, (target) => { const r = this.hit(u, target, 2.5, { basic: true }); if (r && r.crit) sfx('crit'); });
      else heroBasicAttack(this, u, tg, () => strike(tg, false));
    }
    const cdr = 1 + ((M && M.cdr) || 0) / 100;
    for (let i = 0; i < u.skills.length; i++) {
      u.cds[i] -= dt * cdr;
      if (u.cds[i] <= 0) {
        const sk = u.skills[i];
        if (sk.type === 'heal' && u.hp / u.maxHp > 0.75 && sk.id !== 'ninelives') continue;
        if (castSkill(this, u, sk)) {
          u.cds[i] = sk.cd;
          u.anim = 'cast'; u.animK = 0;
          if (u.side === 0 && this.game.onSkillCast) this.game.onSkillCast(i);
        }
      }
    }
  }
  kittenAct(k, dt) {
    const o = k.owner;
    k.facing = o.facing;
    const tx = o.x + k.ox * o.facing, ty = GROUND_Y + k.oy;
    k.x += (tx - k.x) * Math.min(1, dt * 4);
    k.y += (ty - k.y) * Math.min(1, dt * 4);
    k.anim = o.anim === 'run' ? 'run' : k.anim === 'attack' ? 'attack' : 'idle';
    if (o.dead || this.phase !== 'fight') return;
    const foes = this.foes(o);
    if (!foes.length) return;
    k.t -= dt;
    if (k.t <= 0) {
      k.t = 2.2;
      k.anim = 'attack'; k.animK = 0;
      kittenAttack(this, k, foes[0], k.mult, false);
    }
    if (k.r >= 5) {
      k.ultT -= dt;
      if (k.ultT <= 0) { k.ultT = 12; kittenAttack(this, k, foes[0], k.mult, true); }
    }
  }
  poisonTick(e, dt) {
    e.poisonT -= dt;
    e.pTick = (e.pTick || 0) + dt;
    if (e.pTick >= 0.5) {
      e.pTick = 0;
      const d = e.poisonDps * e.poison * 0.5;
      e.hp -= d;
      this.fx.text(e.x, e.y - e.height * 0.6, fmt(d), 'pet');
      poisonFx(this, e);
      if (e.hp <= 0) this.kill(e);
    }
    if (e.poisonT <= 0) e.poison = 0;
  }
  enemyAct(e, dt) {
    if (e.dead) return;
    e.t += dt;
    if (!e.arrived) {
      e.x -= dt * (e.boss ? 80 : 110);
      e.anim = 'run';
      if (e.x <= e.tx) { e.x = e.tx; e.arrived = true; e.anim = 'idle'; }
      return;
    }
    if (this.mods.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * this.mods.regen * dt);
    if (e.boss) {
      if (!e.enraged && e.hp < e.maxHp * 0.3) {
        e.enraged = true; e.interval *= 0.6; this.say(e, 'ENRAGÉ !', 'big'); this.flash('#ff2a3d', 0.35); this.shake(0.8); sfx('thunder');
      }
      if (e.bossSkill) {
        e.skT -= dt;
        if (e.skT <= 0 && this.hero && !this.hero.dead) { e.skT = e.enraged ? 4.5 : 6.5; e.anim = 'attack'; e.animK = 0; bossSkill(this, e, this.hero); }
      }
    }
    if (e.stun > 0) { e.stun -= dt; e.anim = 'stun'; return; }
    if (e.anim === 'stun') e.anim = 'idle';
    e.atkT += dt;
    if (e.atkT >= e.interval) {
      e.atkT = 0;
      e.anim = 'attack'; e.animK = 0;
      const tg = this.hero;
      if (!tg || tg.dead) return;
      enemyAttack(this, e, tg, e.ranged, () => { if (!e.dead && !tg.dead) { this.hit(e, tg, 1, { basic: true }); sfx('enemyHit'); } });
    }
  }

  // ------------------------------------------------------------- boucle
  update(rawDt) {
    this.time += rawDt;
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - rawDt * 2.2);
    if (this.stopT > 0) { this.stopT -= rawDt; this.fx.update(rawDt * 0.1); return; }
    const dt = rawDt * this.speed;
    this.phaseT += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    const H = this.hero;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 1.3) this.setPhase('fight');
        break;
      case 'walk':
        this.scroll += dt * 150;
        H.anim = 'run';
        if (H.aura) auraTick(this, H, dt);
        if (this.phaseT > (this.wave === 0 ? 0.8 : 1)) { this.spawnWave(); H.anim = 'idle'; this.setPhase('fight'); }
        break;
      case 'fight': {
        const anyArrived = this.units.some((u) => u.kind === 'enemy' && u.arrived && !u.dead);
        if (!anyArrived && !this.rival) this.scroll += dt * 40;
        this.heroAct(H, dt);
        if (this.rival) this.heroAct(this.rival, dt);
        for (const u of this.units) if (u.kind === 'enemy') { this.enemyAct(u, dt); if (u.poison && !u.dead) this.poisonTick(u, dt); }
        if (!this.rival) {
          const es = this.units.filter((u) => u.kind === 'enemy');
          if (es.length && es.every((e) => e.dead && e.deadT > 0.5)) {
            this.units = this.units.filter((u) => u.kind !== 'enemy');
            this.wave++;
            if (this.wave >= this.enc.waves.length) { this.setPhase('victory'); sfx('victory'); this.game.onBoss && this.game.onBoss(null); }
            else { this.heal(H, 0.25, true); this.setPhase('walk'); }
          }
        } else if (this.rival.dead && this.phase === 'fight') { this.setPhase('victory'); }
        if (this.enc.timeLimit) {
          this.enc.elapsed = (this.enc.elapsed || 0) + dt;
          if (this.enc.elapsed > this.enc.timeLimit && !H.dead) {
            if (this.enc.timedBoss) { this.setPhase('victory'); sfx('victory'); this.game.onBoss && this.game.onBoss(null); } // temps écoulé : on compte les dégâts
            else { H.dead = true; H.anim = 'dead'; H.animK = 0; this.setPhase('defeat'); }
          }
        }
        break;
      }
      case 'victory':
        if (this.phaseT === dt) this.fx.burst(H.x, H.y - 150, { count: 30, color: ['#ffd23f', '#ffffff', '#ff7ae0'], speed: 160, up: 100, size: 9, life: 1, shape: 'star', gravity: 200 });
        H.anim = H.anim === 'attack' ? H.anim : 'idle';
        if (this.phaseT > 1) { this.setPhase('idle'); this.game.onEncounterEnd(true, this.enc); }
        break;
      case 'defeat':
        if (this.phaseT > 1.6) { this.setPhase('idle'); this.game.onEncounterEnd(false, this.enc); }
        break;
      default: break;
    }
    // animations
    for (const u of this.units) {
      if (u.kind === 'kitten') this.kittenAct(u, dt);
      if (u.flash > 0) u.flash = Math.max(0, u.flash - dt * 6);
      if (['attack', 'hurt', 'cast'].includes(u.anim)) {
        u.animK += dt * (u.anim === 'cast' ? 2.4 : u.anim === 'attack' && u.kind === 'hero' ? 2.8 : 4.5);
        if (u.animK >= 1) { u.anim = u.dead ? 'dead' : 'idle'; u.animK = 0; }
      } else if (u.anim === 'dead') { u.animK = Math.min(1, u.animK + dt * 2.5); u.deadT += dt; }
      if (u.kind === 'hero') {
        const want = u.anim === 'attack' && u.dashTo ? Math.sin(Math.min(1, u.animK) * Math.PI) * u.dashTo : 0;
        u.dash = want;
      }
      if (u.rig) u.rig.update(dt);
    }
    this.fx.update(dt);
    // particules d'ambiance
    if (this.sc && Math.random() < dt * 6) {
      const cols = AMBIENT[this.sc.ambient] || AMBIENT.petals;
      const a = this.sc.ambient;
      const x = Math.random() * this.viewW;
      if (a === 'snow' || a === 'petals' || a === 'leaves' || a === 'rain') this.fx.emit(x, -10, -20 - Math.random() * 20, 30 + Math.random() * 30, cols[Math.floor(Math.random() * cols.length)], a === 'snow' ? 3.5 : 4.5, 6, { shape: a === 'leaves' || a === 'petals' ? 'debris' : 'glow', drag: 0, alpha: 0.85 });
      else if (a === 'bubbles') this.fx.emit(x, 360, 0, -40, cols[0], 5, 5, { shape: 'bubble', drag: 0, alpha: 0.7 });
      else if (a === 'embers') this.fx.emit(x, 330, (Math.random() - 0.5) * 20, -50 - Math.random() * 40, cols[Math.floor(Math.random() * 2)], 3, 3.5, { drag: 0 });
      else this.fx.emit(x, 60 + Math.random() * 220, (Math.random() - 0.5) * 10, -8, cols[Math.floor(Math.random() * cols.length)], 3.5, 3, { shape: a === 'stars' ? 'star' : 'glow', drag: 0 });
    }
  }

  // ------------------------------------------------------------- rendu
  render(dt) {
    const ctx = this.stage.begin(dt);
    const W = this.viewW;
    if (this.sc) drawScenery(ctx, this.sc, this.scroll, W);
    else { ctx.fillStyle = '#6fc8ff'; ctx.fillRect(0, 0, W, 360); }
    this.fx.drawItems(ctx, 'back');
    // auras au sol
    for (const u of this.units) {
      if (u.dead && u.kind !== 'hero') continue;
      if (u.kind === 'enemy' && (u.boss || u.elite)) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ell(ctx, u.x, u.y, (u.boss ? 80 : 36) * u.scale, (u.boss ? 16 : 8) * u.scale); ctx.strokeStyle = rgba(u.boss ? '#ff2a3d' : '#ff9d00', 0.55 + Math.sin(this.time * 5) * 0.2); ctx.lineWidth = 2.5; ctx.stroke();
        ctx.restore();
      }
      if (u.kind === 'kitten' && u.r >= 3) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, u.x, u.y - 2, 12 + u.r * 1.5, ELEMENTS[u.el].color, 0.35 + Math.sin(this.time * 4 + u.ox) * 0.1);
        ctx.restore();
      }
    }
    for (const u of this.units) if (u.kind === 'hero') drawClassSigil(ctx, this, u);
    const order = this.units.slice().sort((a, b) => a.y - b.y);
    for (const u of order) this.drawUnit(ctx, u);
    this.fx.drawItems(ctx, 'front');
    this.fx.drawParticles(ctx);
    if (this.sc) drawSceneryFront(ctx, this.sc, this.scroll, W);
    for (const u of order) { this.drawBar(ctx, u); if (u.kind === 'enemy' && (u.curse || u.poison)) drawMarks(ctx, this, u); }
    this.fx.drawTexts(ctx);
    if (this.phase === 'intro') this.drawVersus(ctx);
    if (this.flashA > 0.01) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(this.flashC, this.flashA * 0.7); ctx.fillRect(0, 0, this.stage.canvas.width, this.stage.canvas.height);
      ctx.restore();
    }
  }
  drawUnit(ctx, u) {
    if (u.kind === 'hero' || u.kind === 'kitten') {
      const x = u.x + (u.dash || 0) * u.facing;
      const st = u.stun > 0 ? 'hurt' : u.anim;
      const hide = u.vanish > 0;
      if (hide) { ctx.save(); ctx.globalAlpha *= 0.18; }
      u.rig.draw(ctx, x, u.y, u.scale, u.facing, { state: st, k: u.animK, flash: u.flash, flashColor: u.flashColor });
      if (hide) ctx.restore();
      if (u.shield > 0 && !u.dead) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const [cx, cy] = this.center(u);
        ell(ctx, cx, cy, 52, 70); ctx.strokeStyle = rgba('#7fd8ff', 0.6 + Math.sin(this.time * 6) * 0.2); ctx.lineWidth = 3; ctx.stroke();
        glow(ctx, cx, cy, 70, '#7fd8ff', 0.18);
        ctx.restore();
      }
      return;
    }
    // ennemi
    const frame = u.anim === 'run' ? Math.floor(u.t * 9) % 4 : Math.floor(u.t * 3.5) % 4;
    const spr = monsterSprite(u.ekind, frame, u.variant);
    let x = u.x, y = u.y, sx = u.scale, sy = u.scale, rot = 0, alpha = 1;
    if (u.anim === 'run' && !u.fly) y -= Math.abs(Math.sin(u.t * 10)) * 3 * u.scale;
    if (u.fly) y -= Math.sin(u.t * 3) * 3;
    else if (u.anim === 'attack') { const a = Math.sin(Math.min(1, u.animK) * Math.PI); x -= a * (u.ranged ? 4 : 18); sx *= 1 + a * 0.06; sy *= 1 - a * 0.06; }
    else if (u.anim === 'hurt') { const a = Math.sin(Math.min(1, u.animK) * Math.PI); x += a * 7; rot = a * 0.08; }
    else if (u.anim === 'dead') { const a = Math.min(1, u.animK); sy *= 1 - a * 0.7; sx *= 1 + a * 0.3; alpha = 1 - a; }
    else { const b = Math.sin(u.t * 3); sy *= 1 + b * 0.025; sx *= 1 - b * 0.012; }
    if (u.stun > 0) rot = Math.sin(u.t * 18) * 0.08;
    if (alpha <= 0.01) return;
    ctx.fillStyle = 'rgba(20,8,40,0.26)'; ell(ctx, u.x, u.y, (u.boss ? 70 : 30) * u.scale, (u.boss ? 12 : 6) * u.scale); ctx.fill();
    drawSprite(ctx, spr, x, y, sx, sy, rot, alpha);
    if (u.enraged && !u.dead) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y - u.height * 0.45, u.height * 0.75, '#ff2a3d', 0.25 + Math.sin(this.time * 8) * 0.1); ctx.restore(); }
    if (u.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y - u.height * 0.45, u.height * 0.6, u.flashColor || '#ffffff', u.flash * 0.75); ctx.restore(); }
    if (u.stun > 0) for (let i = 0; i < 3; i++) { const a = u.t * 5 + i * 2.1; this.fx.emit(x + Math.cos(a) * 16, y - u.height - 6 + Math.sin(a) * 4, 0, 0, '#ffd23f', 5, 0.05, { shape: 'star' }); }
  }
  drawBar(ctx, u) {
    if (u.dead || u.kind === 'kitten' || (u.kind === 'enemy' && (!u.arrived && u.x > this.viewW - 10))) return;
    if (u.boss) return;
    const w = u.kind === 'hero' ? 44 : 30, h = u.kind === 'hero' ? 5.5 : 4.5;
    const x = u.x + (u.dash || 0) * u.facing - w / 2, y = u.y - u.height - (u.kind === 'hero' ? 8 + (u.mech ? 14 : 0) : 6) - (u.fly ? 4 : 0); // chapeaux de classe hauts
    ctx.fillStyle = '#1a0d2e'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, 4) : ctx.rect(x - 1.5, y - 1.5, w + 3, h + 3); ctx.fill();
    const r = Math.max(0, u.hp / u.maxHp);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (u.side === 0) { g.addColorStop(0, '#8dffad'); g.addColorStop(1, '#1fa35c'); } else if (u.elite) { g.addColorStop(0, '#ffc07a'); g.addColorStop(1, '#d65a00'); } else { g.addColorStop(0, '#ff8590'); g.addColorStop(1, '#d62839'); }
    ctx.fillStyle = g; ctx.fillRect(x, y, w * r, h);
    if (u.shield > 0) { ctx.fillStyle = 'rgba(160,235,255,0.85)'; ctx.fillRect(x, y, w * Math.min(1, u.shield / u.maxHp), h * 0.45); }
    if (u.kind === 'hero' && this.rival) {
      ctx.font = '11px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.fillStyle = u.side ? '#ffd6da' : '#e6ffe9';
      ctx.strokeText(u.name, x + w / 2, y - 7); ctx.fillText(u.name, x + w / 2, y - 7);
    }
  }
  drawVersus(ctx) {
    const k = Math.min(1, this.phaseT / 0.35);
    const W = this.viewW;
    ctx.save();
    ctx.translate(W / 2, 150);
    ctx.scale(2.4 - k * 1.4, 2.4 - k * 1.4);
    ctx.globalAlpha = Math.min(1, k * 1.5) * (this.phaseT > 1.05 ? Math.max(0, 1 - (this.phaseT - 1.05) * 4) : 1);
    ctx.font = '54px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#2b1838'; ctx.strokeText('VS', 0, 0);
    const g = ctx.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, '#fff6b0'); g.addColorStop(1, '#ff5ca8');
    ctx.fillStyle = g; ctx.fillText('VS', 0, 0);
    ctx.restore();
  }
}
