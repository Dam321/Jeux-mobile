// Équilibrage des classes : même joueur (gratuit, 20 jours), une classe/spécialisation à la fois.
// Mesure l'étape maximale franchie (moyenne de plusieurs graines de hasard) et les gains face aux boss.
import { run } from './sim.mjs';
import { CLASSES } from '../src/classes.js';

const DAYS = +(process.argv[2] || 20), RUNS = +(process.argv[3] || 3);
const rows = [];
for (const C of CLASSES) for (const S of C.specs) {
  let tot = 0;
  for (let i = 0; i < RUNS; i++) { const out = {}; run('f2p', DAYS, C.id, S.id, out); tot += out.st.camp.best; }
  const best = tot / RUNS;
  rows.push({ classe: C.name, spec: S.name, etape: +best.toFixed(1), map: `${Math.floor(best / 10) + 1}-${Math.floor(best % 10) + 1}` });
}
const avg = rows.reduce((a, r) => a + r.etape, 0) / rows.length;
for (const r of rows) r.ecart = +(r.etape - avg).toFixed(1);
console.table(rows);
console.log('moyenne', avg.toFixed(1), 'écart max', Math.max(...rows.map((r) => Math.abs(r.ecart))).toFixed(1));
