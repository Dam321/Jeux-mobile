// Moteur de combat temps réel (visuel) — campagne, donjons, tour, arène
import * as THREE from 'three';
import { CatModel, EnemyModel, PetModel } from './three/models.js';
import { castSkill, petShot } from './three/skillfx.js';
import { hitDamage, attackInterval } from './combat.js';
import { fmt } from './util.js';
import { sfx } from './audio.js';

const CAT_X = -2.7, CAT_Z = 0.35;
const PET_POS = [[-3.6, 1.45], [-3.85, -0.85], [-4.5, 0.4]];
const CAT_YAW = Math.PI / 2 - 0.55;
const ENEMY_YAW = -Math.PI / 2 + 0.55;

function slotPos(i, n, boss) {
  if (boss && n === 1) return [-0.55, 0.3];
  const col = Math.floor(i / 2), row = i % 2;
  return [-1.35 + col * 1.25 + row * 0.35, row ? -0.65 : 0.85];
}

export class Battle {
  constructor(world, fx, game, barsLayer) {
    this.world = world;
    this.fx = fx;
    this.game = game;
    this.bars = barsLayer;
    this.enemies = [];
    this.pets = [];
    this.timers = [];
    this.speed = 1;
    this.phase = 'idle';
    this.phaseT = 0;
    this.mode = 'campaign';
    this.player = { model: new CatModel('tabby'), hp: 100, maxHp: 100, shield: 0, atkT: 0, buff: 0, buffT: 0, anim: 'idle', animK: 0, animT: 0 };
    const pm = this.player.model.root;
    pm.position.set(CAT_X, 0, CAT_Z);
    pm.rotation.y = CAT_YAW;
    world.scene.add(pm);
    this.player.bar = this.makeBar(true);
    this.skillCd = [];
    this.tmp = { x: 0, y: 0 };
  }

  makeBar(isPlayer) {
    const el = document.createElement('div');
    el.className = 'hpbar' + (isPlayer ? ' me' : '');
    el.innerHTML = '<i class="sh"></i><i class="fill"></i><b></b>';
    this.bars.appendChild(el);
    return { el, fill: el.children[1], sh: el.children[0], lbl: el.children[2], last: -1 };
  }

  // ------------------------------------------------------------- configuration du joueur
  setPlayer(stats, skills, pets, skinId, gear) {
    const P = this.player;
    const ratio = P.maxHp ? P.hp / P.maxHp : 1;
    P.stats = stats;
    P.maxHp = stats.hp;
    P.hp = Math.min(stats.hp, Math.max(1, ratio * stats.hp));
    if (P.model.skinId !== skinId) P.model.setLook(skinId, gear);
    else P.model.setGear(gear);
    // compétences
    const old = Object.fromEntries((this.skills || []).map((s, i) => [s.id, this.skillCd[i]]));
    this.skills = skills;
    this.skillCd = skills.map((s) => old[s.id] ?? s.cd * 0.4);
    // compagnons
    const ids = pets.map((p) => p.id).join(',');
    if (ids !== this.petIds) {
      for (const p of this.pets) this.world.scene.remove(p.model.root);
      this.pets = pets.map((p, i) => {
        const m = new PetModel(p.id);
        m.root.position.set(PET_POS[i][0], 0, PET_POS[i][1]);
        m.root.rotation.y = CAT_YAW;
        this.world.scene.add(m.root);
        return { def: p, model: m, t: 1 + i * 0.7, animK: 1 };
      });
      this.petIds = ids;
    } else this.pets.forEach((p, i) => { p.def = pets[i]; });
  }

  // ------------------------------------------------------------- démarrage des rencontres
  clearEnemies() {
    for (const e of this.enemies) { this.world.scene.remove(e.model.root); e.bar.el.remove(); }
    this.enemies = [];
  }
  start(enc) {
    // enc : { mode, waves, title, rival?, onEnd(win), keepHp }
    this.clearEnemies();
    this.timers = [];
    this.enc = enc;
    this.mode = enc.mode;
    this.wave = 0;
    this.fx.clear();
    const P = this.player;
    if (!enc.keepHp) { P.hp = P.maxHp; P.shield = 0; }
    P.dead = false;
    P.anim = 'idle';
    this.skillCd = this.skills.map((s) => s.cd * 0.35);
    this.setPhase('walk');
    this.game.onEncounterStart && this.game.onEncounterStart(enc);
  }
  setPhase(p) { this.phase = p; this.phaseT = 0; }

  spawnWave() {
    const defs = this.enc.waves[this.wave];
    const n = defs.length;
    defs.forEach((d, i) => {
      let model;
      if (d.rival) {
        model = new CatModel(d.skin || 'tabby', d.gear || {});
        model.height = 2;
      } else model = new EnemyModel(d.kind, { boss: d.boss, elite: d.elite });
      const [sx, sz] = slotPos(i, n, d.boss || d.rival);
      model.root.position.set(8.5 + i * 0.9, 0, sz);
      model.root.rotation.y = ENEMY_YAW;
      this.world.scene.add(model.root);
      const e = { def: d, model, hp: d.hp, maxHp: d.hp, tx: d.rival ? -0.4 : sx, arrived: false, atkT: d.interval * (0.3 + Math.random() * 0.5), stun: 0, anim: 'run', animK: 0, dead: false, deadT: 0, bar: this.makeBar(false), boss: d.boss, rival: d.rival, skT: 4 };
      if (d.boss || d.rival) e.bar.el.classList.add('boss');
      if (d.elite) e.bar.el.classList.add('elite');
      this.enemies.push(e);
    });
    const boss = defs.find((d) => d.boss || d.rival);
    this.game.onBoss && this.game.onBoss(boss ? { name: boss.name || 'Boss', hp: 1 } : null);
    if (boss) { sfx('thunder'); this.fx.flash('#ff2a3d', 0.25); this.world.shake = 0.6; }
  }

  targets() {
    const a = this.enemies.filter((e) => !e.dead && e.arrived);
    a.sort((x, y) => x.model.root.position.x - y.model.root.position.x);
    return a;
  }

  later(delay, fn) { this.timers.push({ t: delay, fn }); }

  say(ent, txt, cls) {
    const p = ent.model.root.position.clone();
    p.y += (ent.model.height || 2) + 0.6;
    this.fx.text(p, txt, cls);
  }

  // ------------------------------------------------------------- dégâts
  hit(e, mult, o = {}) {
    if (e.dead) return;
    const S = this.player.stats;
    const atk = S.atk * (1 + this.player.buff);
    let dmg = hitDamage(atk, e.def.def) * mult;
    let crit = false;
    if (!o.noCrit && Math.random() * 100 < S.crit) { crit = true; dmg *= 1 + S.critDmg / 100; }
    if (o.skill && !o.pet) dmg *= 1 + S.skillDmg / 100;
    if (e.boss || e.rival) dmg *= 1 + S.bossDmg / 100;
    dmg *= 0.92 + Math.random() * 0.16;
    e.hp -= dmg;
    e.model.flash(crit ? 0xffe08a : 0xffffff, 0.1);
    if (e.anim !== 'attack') { e.anim = 'hit'; e.animK = 0; }
    const p = e.model.root.position.clone();
    p.y += e.model.height * 0.75;
    this.fx.text(p, (crit ? '💥' : '') + fmt(dmg), crit ? 'crit' : o.skill ? 'skill' : 'dmg');
    if (!o.skill && S.lifesteal > 0) this.heal((dmg * S.lifesteal) / 100 / this.player.maxHp, true);
    if (e.hp <= 0) this.kill(e);
    return { dmg, crit };
  }

  kill(e) {
    e.dead = true;
    e.anim = 'dead'; e.animK = 0; e.deadT = 0;
    const p = e.model.root.position.clone().setY(0.6);
    this.fx.burst(p, { count: e.boss ? 80 : 26, color: ['#ffffff', '#ffe08a', '#c9cbd8'], speed: e.boss ? 8 : 5, size: e.boss ? 0.45 : 0.3, life: 0.6, up: 1.5 });
    this.fx.burst(p, { count: 8, color: '#ffd23f', speed: 4, size: 0.25, life: 0.9, shape: 1, gravity: 5, up: 3 });
    if (e.boss) { this.world.shake = 1.2; this.fx.flash('#ffffff', 0.5); this.fx.ring(p.clone().setY(0.05), '#ffd23f', { r1: 5 }); }
    this.game.onKill && this.game.onKill(e, this.world.project(p, { x: 0, y: 0 }));
    sfx('coin');
  }

  heal(pct, silent) {
    const P = this.player;
    const amt = P.maxHp * pct;
    P.hp = Math.min(P.maxHp, P.hp + amt);
    if (!silent) {
      const p = P.model.root.position.clone(); p.y += 2.3;
      this.fx.text(p, '+' + fmt(amt), 'heal');
    }
  }
  addShield(pct) {
    const P = this.player;
    P.shield = P.maxHp * pct;
    if (!P.shieldMesh) P.shieldMesh = this.fx.shield(P.model.root);
    P.shieldMesh.visible = true;
  }
  buff(v, dur) { this.player.buff = v; this.player.buffT = dur; }

  hurtPlayer(e, mult = 1) {
    const P = this.player;
    if (P.dead) return;
    const S = P.stats;
    if (Math.random() * 100 < S.dodge) {
      this.say(P, 'ESQUIVE', 'miss');
      return;
    }
    let dmg = hitDamage(e.def.atk, S.def) * mult * (0.92 + Math.random() * 0.16);
    let ecrit = false;
    if (e.rival && Math.random() * 100 < (e.def.crit || 10)) { dmg *= 1 + (e.def.critDmg || 50) / 100; ecrit = true; }
    if (P.shield > 0) {
      const a = Math.min(P.shield, dmg);
      P.shield -= a; dmg -= a;
      if (P.shield <= 0 && P.shieldMesh) { P.shieldMesh.visible = false; this.fx.burst(P.model.root.position.clone().setY(1), { count: 30, color: '#7fd8ff', speed: 5, size: 0.2, life: 0.5 }); }
    }
    P.hp -= dmg;
    P.model.flash(0xff4d5e, 0.12);
    const p = P.model.root.position.clone(); p.y += 1.9;
    if (dmg > 0) this.fx.text(p, '-' + fmt(dmg), ecrit ? 'hurt crit' : 'hurt');
    this.fx.burst(P.model.root.position.clone().setY(1), { count: 8, color: ['#ff4d5e', '#ffffff'], speed: 3, size: 0.18, life: 0.3 });
    sfx('enemyHit');
    if (Math.random() * 100 < S.counter) {
      this.later(0.12, () => { if (!e.dead && !P.dead) { this.say(P, 'RIPOSTE', 'tag'); this.hit(e, 1); this.fx.slash(e.model.root.position.clone().setY(1), '#ffb52e', { scale: 1 }); } });
    }
    if (P.hp <= 0) {
      P.hp = 0;
      P.dead = true;
      P.anim = 'dead'; P.animK = 0;
      sfx('defeat');
      this.setPhase('defeat');
    }
  }

  playerAttack(tg) {
    const P = this.player;
    P.anim = 'attack'; P.animK = 0;
    this.later(0.12, () => {
      if (tg.dead) { tg = this.targets()[0]; if (!tg) return; }
      const p = tg.model.root.position.clone(); p.y += Math.min(1.2, tg.model.height * 0.55);
      const r = this.hit(tg, 1);
      this.fx.slash(p, r && r.crit ? '#ffd23f' : '#ffffff', { scale: r && r.crit ? 1.5 : 1.1 });
      this.fx.burst(p, { count: r && r.crit ? 18 : 8, color: r && r.crit ? ['#ffd23f', '#ffffff'] : ['#ffffff', '#ffe9c4'], speed: r && r.crit ? 7 : 4, size: 0.2, life: 0.3 });
      if (r && r.crit) { this.world.shake = Math.max(this.world.shake, 0.35); sfx('crit'); } else sfx('hit');
      const S = P.stats;
      if (!tg.dead && Math.random() * 100 < S.stun) { tg.stun = 1.2; this.say(tg, 'ÉTOURDI', 'tag'); }
      if (Math.random() * 100 < S.combo) {
        this.later(0.16, () => {
          const t2 = tg.dead ? this.targets()[0] : tg;
          if (!t2) return;
          this.say(P, 'COMBO', 'tag');
          const p2 = t2.model.root.position.clone(); p2.y += 0.9;
          this.hit(t2, 1);
          this.fx.slash(p2, '#7fe9ff', { rz: 1.2, scale: 1.2 });
          sfx('hit');
        });
      }
    });
  }

  // ------------------------------------------------------------- boucle
  update(rawDt) {
    const dt = rawDt * this.speed;
    const P = this.player;
    this.phaseT += dt;
    // minuteries
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    if (P.buffT > 0) { P.buffT -= dt; if (P.buffT <= 0) P.buff = 0; if (Math.random() < 0.3) this.fx.sparkle(P.model.root.position.clone().setY(1.2), '#ffd23f', 1, 0.3, 1.4); }

    switch (this.phase) {
      case 'walk': {
        this.world.scrollSpeed = 4.2;
        P.anim = 'run';
        if (this.phaseT > (this.wave === 0 ? 0.9 : 1.1)) { this.spawnWave(); this.setPhase('fight'); }
        break;
      }
      case 'fight': {
        const anyArrived = this.enemies.some((e) => e.arrived && !e.dead);
        this.world.scrollSpeed = anyArrived ? 0 : Math.max(0, this.world.scrollSpeed - dt * 6);
        if (!anyArrived && P.anim === 'run' && this.world.scrollSpeed <= 0) P.anim = 'idle';
        if (P.dead) break;
        // attaque de base
        const tg = this.targets();
        const S = P.stats;
        if (tg.length) {
          P.atkT += dt;
          const iv = attackInterval(S);
          if (P.atkT >= iv) { P.atkT = 0; this.playerAttack(tg[0]); }
          // compétences
          for (let i = 0; i < this.skills.length; i++) {
            this.skillCd[i] -= dt;
            if (this.skillCd[i] <= 0) {
              const sk = this.skills[i];
              if (sk.type === 'heal' && P.hp / P.maxHp > 0.75 && sk.id !== 'ninelives') continue;
              if (castSkill(this, sk)) {
                this.skillCd[i] = sk.cd;
                P.anim = 'cast'; P.animK = 0;
                this.game.onSkillCast && this.game.onSkillCast(i);
              }
            }
          }
          // compagnons
          for (const pet of this.pets) {
            pet.t -= dt;
            if (pet.t <= 0) {
              pet.t = 2.2;
              pet.animK = 0;
              petShot(this, pet.def, pet.model, tg[0], pet.def.mult * pet.def.lm);
            }
          }
        }
        // ennemis
        for (const e of this.enemies) {
          if (e.dead) continue;
          const pos = e.model.root.position;
          if (!e.arrived) {
            pos.x -= dt * (e.boss ? 2.6 : 3.4);
            e.anim = 'run';
            if (pos.x <= e.tx) { pos.x = e.tx; e.arrived = true; e.anim = 'idle'; }
            continue;
          }
          if (e.stun > 0) { e.stun -= dt; e.anim = 'stun'; if (Math.random() < 0.2) this.fx.sparkle(pos.clone().setY(e.model.height + 0.2), '#ffd23f', 1, 0.25, 0.6); continue; }
          if (e.anim === 'stun') e.anim = 'idle';
          e.atkT += dt;
          if (e.atkT >= e.def.interval) {
            e.atkT = 0;
            e.anim = 'attack'; e.animK = 0;
            this.later(0.15, () => { if (!e.dead) this.hurtPlayer(e); });
          }
          if (e.rival) {
            e.skT -= dt;
            if (e.skT <= 0) {
              e.skT = 6;
              const pp = P.model.root.position.clone();
              this.fx.lightning(new THREE.Vector3(pp.x, 9, pp.z - 1), pp.clone().setY(0.3), '#ff4d5e');
              this.fx.blast(pp.clone().setY(0.8), '#ff4d5e', { r1: 1.6 });
              this.world.shake = 0.6;
              sfx('thunder');
              this.hurtPlayer(e, 2.5);
            }
          }
        }
        // fin de vague ?
        if (this.enemies.length && this.enemies.every((e) => e.dead && e.deadT > 0.45)) {
          this.clearEnemies();
          this.wave++;
          if (this.wave >= this.enc.waves.length) {
            this.setPhase('victory');
            sfx('victory');
            this.game.onBoss && this.game.onBoss(null);
          } else {
            this.heal(0.25, true);
            this.setPhase('walk');
          }
        }
        if (this.enc.timeLimit && this.phase === 'fight') {
          this.enc.elapsed = (this.enc.elapsed || 0) + dt;
          if (this.enc.elapsed > this.enc.timeLimit) { P.hp = 0; P.dead = true; P.anim = 'dead'; P.animK = 0; this.setPhase('defeat'); }
        }
        break;
      }
      case 'victory': {
        P.anim = 'idle';
        this.world.scrollSpeed = 0;
        if (this.phaseT === dt) this.fx.burst(P.model.root.position.clone().setY(2.2), { count: 30, color: ['#ffd23f', '#ffffff', '#ff7ae0'], speed: 4, up: 3, size: 0.25, life: 1, shape: 1, gravity: 3 });
        if (this.phaseT > 0.9) { this.setPhase('idle'); this.game.onEncounterEnd(true, this.enc); }
        break;
      }
      case 'defeat': {
        this.world.scrollSpeed = 0;
        if (this.phaseT > 1.6) { this.setPhase('idle'); this.clearEnemies(); this.game.onEncounterEnd(false, this.enc); }
        break;
      }
      default: this.world.scrollSpeed = 0; break;
    }

    // animations
    this.animate(P, rawDt, dt);
    for (const e of this.enemies) {
      this.animate(e, rawDt, dt);
      if (e.dead) {
        e.deadT += dt;
        if (e.deadT > 0.45) e.model.root.visible = false;
      }
    }
    for (const pet of this.pets) {
      pet.animK = Math.min(1, pet.animK + dt * 3);
      pet.model.update(dt, pet.animK);
    }
    if (P.shieldMesh && P.shieldMesh.visible) { P.shieldMesh.rotation.y += dt; P.shieldMesh.material.uniforms.uO.value = 0.6 + Math.sin(this.world.time * 6) * 0.2; }
    this.updateBars();
  }

  animate(ent, rawDt, dt) {
    if (['attack', 'hit', 'cast'].includes(ent.anim)) {
      ent.animK += dt * (ent.anim === 'cast' ? 2.5 : 4.5);
      if (ent.animK >= 1) { ent.anim = ent.dead ? 'dead' : 'idle'; ent.animK = 0; }
    } else if (ent.anim === 'dead') ent.animK = Math.min(1, ent.animK + dt * 2.5);
    ent.model.update(dt, ent.anim, ent.animK);
  }

  updateBars() {
    const list = [this.player, ...this.enemies];
    for (const ent of list) {
      const b = ent.bar;
      const vis = ent === this.player ? !ent.dead : !ent.dead && ent.model.root.position.x < 7;
      if (!vis) { if (b.el.style.display !== 'none') b.el.style.display = 'none'; continue; }
      if (b.el.style.display === 'none') b.el.style.display = '';
      const p = ent.model.root.position;
      const v = new THREE.Vector3(p.x, (ent.model.height || 2) + (ent === this.player ? 0.45 : 0.3), p.z);
      this.world.project(v, this.tmp);
      b.el.style.transform = `translate(${this.tmp.x.toFixed(1)}px, ${this.tmp.y.toFixed(1)}px)`;
      const max = ent.maxHp || 1;
      const r = Math.max(0, ent.hp / max);
      if (Math.abs(r - b.last) > 0.002) { b.fill.style.transform = `scaleX(${r})`; b.last = r; }
      if (ent === this.player) {
        const s = Math.min(1, ent.shield / max);
        b.sh.style.transform = `scaleX(${s})`;
      }
    }
    // barre du boss
    const boss = this.enemies.find((e) => (e.boss || e.rival) && !e.dead);
    if (boss && this.game.onBoss) this.game.onBossHp && this.game.onBossHp(Math.max(0, boss.hp / boss.maxHp), boss.hp);
  }
}
