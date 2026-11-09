// Interface des classes : onglet « Classe », sélection (cartes vitrines), révélation plein écran.
import { h } from '../util.js';
import { icon } from './icons.js';
import { SUBSTATS, SLOTS } from '../config.js';
import { CLASSES, CLASS_BY_ID, SPEC_LEVEL, classOf, specOf } from '../classes.js';
import { catFullURL } from '../gfx/cat.js';
import { lazyImg } from './lazy.js';
import { sfx } from '../audio.js';

const STAT_NAME = { atk: 'ATQ', hp: 'PV', def: 'DÉF', kitDmg: 'dégâts des chatons' };
export function fxLines(fx) {
  return Object.entries(fx || {}).map(([k, v]) => `${v > 0 ? '+' : '−'}${Math.abs(v)} % ${STAT_NAME[k] || (SUBSTATS[k] ? SUBSTATS[k].name.toLowerCase() : k)}`);
}
const baseName = (slot, base) => SLOTS.find((s) => s.id === slot).bases[base] || base;
const vars = (C) => ({ '--cc': C.color, '--ca': C.accent });

// vitrine : le chat dans la tenue de sa classe, avec arme et armure épiques
export function classShowcase(C, cls = '') {
  const s = C.showcase;
  return lazyImg('cls:' + C.id, () => catFullURL({ ...C.look, cls: C.id }, { weapon: { base: s.weapon, r: s.r }, armor: { base: s.armor, r: s.r } }, 220), cls);
}

// ------------------------------------------------------------------ onglet Héros > Classe
export function classPanel(ui, g) {
  const st = g.st, C = classOf(st), SP = specOf(st);
  if (!C) {
    return h('div.col', null,
      h('div.cls-empty', null, h('b', null, 'Aucune classe'), h('p', null, 'Choisissez une classe : elle change votre style de combat, votre coup final, vos armes et vos armures.')),
      h('button.btn.gold.wide', { onclick: () => classPicker(ui, g) }, h('span', null, 'Choisir ma classe')),
    );
  }
  const lvlOk = st.hero.lvl >= SPEC_LEVEL;
  const cost = g.specCost(), ccost = g.classCost();
  return h('div.col', null,
    h('div.cls-hero', { style: vars(C) },
      h('div.cls-glow'),
      h('img.cls-hero-img', { src: g.fullURL(), alt: '' }),
      h('div.cls-hero-txt', null,
        h('small', null, C.role.toUpperCase()), h('b', null, C.name), h('em', null, C.tagline),
        SP ? h('span.cls-spec-tag', null, SP.icon + ' ' + SP.name) : null),
    ),
    h('p.small', null, C.desc),
    h('div.cls-grid', null,
      h('div.cls-box', { style: vars(C) }, h('h5', null, 'Bonus de classe'), h('ul.lines', null, fxLines(C.base).map((t) => h('li', null, t)))),
      h('div.cls-box', { style: vars(C) }, h('h5', null, 'Coup final'), h('b.cls-ult', null, C.ult.name),
        h('p.small.muted', null, `Toutes les ${SP && SP.mech && SP.mech.ultEvery ? SP.mech.ultEvery : 5} attaques · ${C.ult.aoe ? 'tous les ennemis' : 'cible unique'} · ×${C.ult.mult}${C.ult.heal ? ` · soigne ${Math.round(C.ult.heal * 100)} %` : ''}`)),
    ),
    h('div.cls-box', { style: vars(C) }, h('h5', null, 'Équipement réservé'),
      h('div.cls-gear', null,
        C.weapons.map((b) => h('div.cls-gear-it', null, ui.itemImg('weapon', b, 5), h('small', null, baseName('weapon', b)))),
        C.armors.map((b) => h('div.cls-gear-it', null, ui.itemImg('armor', b, 5), h('small', null, baseName('armor', b))))),
      h('p.small.muted', null, 'Les armes et armures des autres classes ne peuvent pas être portées. Les reliques s\'adaptent à toutes les classes.')),
    h('h4', null, lvlOk ? 'Spécialisation' : `Spécialisation (niveau ${SPEC_LEVEL})`),
    h('div.spec-list', null, C.specs.map((S) => {
      const on = SP && SP.id === S.id;
      return h('div.spec-card', { cls: (on ? 'on' : '') + (lvlOk ? '' : ' locked'), style: vars(C) },
        h('i.spec-ic', null, S.icon),
        h('div.grow', null, h('b', null, S.name), h('p.small', null, S.desc), S.fx && Object.keys(S.fx).length ? h('small.muted', null, fxLines(S.fx).join(' · ')) : null),
        on ? h('span.spec-on', null, 'ACTIVE')
          : h('button.btn.sm', { cls: lvlOk ? 'gold' : 'gray', disabled: !lvlOk, onclick: () => g.chooseSpec(S.id) }, h('span', null, cost ? 'Changer' : 'Choisir'), cost ? h('small', { html: icon('gems') + ' ' + cost }) : h('small', null, 'gratuit')));
    })),
    h('button.btn.purple.wide', { onclick: () => classPicker(ui, g) }, h('span', null, 'Changer de classe'), h('small', { html: ccost ? icon('gems') + ' ' + ccost : 'Premier changement gratuit' })),
  );
}

// ------------------------------------------------------------------ sélection
export function classPicker(ui, g, first = false) {
  const st = g.st;
  const body = h('div.cls-pick', null,
    first ? h('p.small.center', null, 'Chaque classe a son style, son coup final, ses armes et ses armures. Deux spécialisations au niveau 25.') : null,
    h('div.cls-cards', null, CLASSES.map((C, i) => h('button.cls-card', { cls: st.hero.cls === C.id ? 'cur' : '', style: { ...vars(C), animationDelay: i * 0.06 + 's' }, onclick: () => { sfx('click'); classDetail(ui, g, C, close); } },
      h('div.cls-card-bg'),
      classShowcase(C, 'cls-card-img'),
      h('div.cls-card-txt', null, h('small', null, C.role), h('b', null, C.name), h('em', null, C.tagline)),
      st.hero.cls === C.id ? h('i.cls-cur', null, 'ACTUELLE') : null,
    ))),
  );
  const close = ui.modal({ title: first ? 'Choisissez votre classe' : 'Classes', body, cls: 'cls-modal', noClose: first });
}

function classDetail(ui, g, C, closePicker) {
  const st = g.st;
  let look = !st.hero.cls; // au premier choix, on adopte le look de la classe par défaut
  const cost = st.hero.cls === C.id ? 0 : g.classCost();
  const tog = h('button.toggle', { cls: look ? 'on' : '', onclick: () => { look = !look; tog.classList.toggle('on', look); } }, h('span', null, 'Adopter le pelage de la classe'), h('i'));
  const body = h('div.col.cls-detail', { style: vars(C) },
    h('div.cls-hero', { style: vars(C) }, h('div.cls-glow'), classShowcase(C, 'cls-hero-img'),
      h('div.cls-hero-txt', null, h('small', null, C.role.toUpperCase()), h('b', null, C.name), h('em', null, C.tagline))),
    h('p.small', null, C.desc),
    h('div.cls-grid', null,
      h('div.cls-box', null, h('h5', null, 'Bonus'), h('ul.lines', null, fxLines(C.base).map((t) => h('li', null, t)))),
      h('div.cls-box', null, h('h5', null, 'Coup final'), h('b.cls-ult', null, C.ult.name), h('p.small.muted', null, C.ult.aoe ? 'Frappe tous les ennemis' : 'Frappe la cible'))),
    h('div.cls-box', null, h('h5', null, 'Armes et armures'), h('p.small', null, [...C.weapons.map((b) => baseName('weapon', b)), ...C.armors.map((b) => baseName('armor', b))].join(' · '))),
    h('div.cls-box', null, h('h5', null, `Spécialisations (niveau ${SPEC_LEVEL})`), C.specs.map((S) => h('p.small', null, h('b', null, `${S.icon} ${S.name} : `), S.desc))),
    st.hero.cls === C.id ? null : tog,
  );
  const buttons = st.hero.cls === C.id ? [{ label: 'Classe actuelle', cls: 'gray' }] : [{
    label: 'Devenir ' + C.name, sub: cost ? `${icon('gems')} ${cost}` : 'Gratuit', cls: 'gold',
    fn: () => { if (g.chooseClass(C.id, look)) { closePicker && closePicker(); } else return true; },
  }];
  ui.modal({ title: C.name, body, buttons, cls: 'cls-modal' });
}

// ------------------------------------------------------------------ révélation plein écran
export function classReveal(ui, g, C) {
  sfx('legendary');
  const el = h('div.cls-reveal', { style: vars(C), onclick: () => done() },
    h('div.cls-rays'), h('div.cls-burst'),
    h('img.cls-reveal-img', { src: g.fullURL(), alt: '' }),
    h('div.cls-reveal-txt', null, h('small', null, 'VOUS ÊTES DÉSORMAIS'), h('b', null, C.name.toUpperCase()), h('em', null, C.role + ' · ' + C.tagline)),
  );
  let gone = false;
  const done = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), 400); };
  ui.app.append(el);
  if (g.battle) { g.battle.flash(C.color, 0.6); g.battle.shake(0.8); }
  setTimeout(done, 3200);
}
