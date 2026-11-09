// Génère des icônes 2D à partir des modèles 3D (rendu hors écran, une seule fois)
import * as THREE from 'three';
import { CatModel, PetModel, EnemyModel } from './models.js';
import { SKINS, PETS } from '../config.js';

export function renderSnapshots() {
  const out = {};
  let r;
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 160;
    r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { return out; }
  r.setPixelRatio(1);
  r.setSize(160, 160, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8866aa, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 6, 8);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const shot = (obj, camPos, look, key) => {
    scene.add(obj);
    cam.position.set(...camPos);
    cam.lookAt(...look);
    r.render(scene, cam);
    out[key] = r.domElement.toDataURL('image/png');
    scene.remove(obj);
  };
  for (const s of SKINS) {
    const m = new CatModel(s.id, {});
    m.update(0, 'idle');
    m.root.rotation.y = 0.35;
    m.shadow.visible = false;
    shot(m.root, [0, 1.6, 4.3], [0, 1.35, 0], 'head_' + s.id);
    shot(m.root, [0, 1.4, 6.4], [0, 1.0, 0], 'skin_' + s.id);
  }
  for (const p of PETS) {
    const m = new PetModel(p.id);
    m.update(0);
    m.root.scale.setScalar(1);
    m.pivot.position.y = 0;
    m.root.rotation.y = 0.5;
    m.shadow.visible = false;
    shot(m.root, [0, 0.4, 2.6], [0, 0.05, 0], 'pet_' + p.id);
  }
  for (const k of ['rat', 'dog', 'vacuum', 'cucumber']) {
    const m = new EnemyModel(k, {});
    m.update(0, 'idle');
    m.root.rotation.y = -0.4;
    m.shadow.visible = false;
    shot(m.root, [0, 1.3, 5], [0, 0.8, 0], 'enemy_' + k);
  }
  r.dispose();
  try { r.forceContextLoss(); } catch (e) { /* ignore */ }
  return out;
}
