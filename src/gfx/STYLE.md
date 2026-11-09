# Style graphique « Miaou » (référence commune)

Tout est dessiné en Canvas 2D par le code, avec les outils de `draw.js`.

- **Contour** : couleur `OUT` (#2b1838), 3 unités pour les grandes formes, 2 pour les détails. Coins arrondis (`lineJoin: round`).
- **Ombrage** : *cel shading* net, pas de simple dégradé. Utiliser `cel(ctx, shape, base, { cx, cy, size })` sur chaque grande forme : ombre franche en croissant en bas à droite, tache de lumière en haut à gauche, petit reflet blanc. La lumière vient toujours d'en haut à gauche.
- **Yeux** : grands et expressifs (sclère blanche ou iris plein, pupille sombre, 2 reflets blancs). Sourcils et paupières donnent l'humeur.
- **Couleurs** : saturées, 3 à 4 teintes par personnage, une couleur d'accent forte (accessoire, marque, lueur).
- **Lisibilité** : en combat, les personnages s'affichent petits (≈ 40 à 70 px de haut sur téléphone). Silhouette forte, détails épais, pas de traits fins isolés. La silhouette doit se reconnaître en ombre chinoise.
- **Lueurs** : `glow()` pour les éléments magiques ou électriques (cristaux, LED, flammes, auras), avec parcimonie.
- **Repère** : pieds en y = 0, y vers le bas, x = 0 au centre. Les ennemis regardent vers la gauche, les chats vers la droite.
