# Miaou Empire

Jeu mobile « idle RPG » en 3D cartoon. Le joueur incarne Minou, un chat qui combat automatiquement des rats, des chiens, des aspirateurs robots et des concombres maléfiques. Il ouvre le **carton magique** pour s'équiper et devient de plus en plus fort.

Le jeu s'inspire du genre Legend of Mushroom / Last War (combat automatique, tirages, VIP, offres), sans copier leur contenu : les personnages, les objets, les ennemis et l'interface sont originaux.

## Lancer le jeu

```bash
npm install
npm run build      # produit dist/index.html (jeu complet en un seul fichier)
npm run serve      # http://localhost:8080 — ouvrir aussi depuis un téléphone sur le même Wi‑Fi
```

`dist/index.html` fonctionne aussi hors serveur (double‑clic). `dist/artifact.html` est la même page au format « fragment » pour une publication web.

## Boucle de jeu

1. **Combat auto** (3D Three.js) : 3 vagues par étape, boss toutes les 10 étapes, 7 biomes (Jardin, Automne, Plage, Neige, Ville Néon, Volcan, Nébuleuse).
2. **Carton magique** : 1 pelote = 1 objet aléatoire (8 emplacements, 9 raretés de Commun à Primordial). Chaque ouverture donne de l'XP au héros, et le niveau du héros fixe le niveau des objets.
3. **Amélioration du carton** (or + temps, accélérable en gemmes) : de meilleures chances de raretés.
4. **Pouvoirs** (12 compétences, gacha à plumes) et **Compagnons** (7 familiers, gacha à œufs). Les doublons font monter de niveau, et une garantie (pity) est affichée.
5. **Entraînement** (or) : % ATQ/PV/DÉF/Critique permanents.
6. **Costumes** : 10 skins, tous cumulables en bonus de stats.
7. **Aventure** : Arbre à Chat (tour infinie), 3 donjons quotidiens à clés, Arène classée (60 adversaires, les premiers rangs étant des « baleines »).
8. **Rétention** : butin passif / hors‑ligne, quêtes quotidiennes + coffres d'activité, connexion 7 jours, objectifs, vidéos bonus.

## Monétisation (achats simulés)

| Levier | Contenu |
|---|---|
| Gemmes | 6 paliers de 0,99 € à 99,99 €, ×2 au premier achat de chaque palier |
| Premier achat | Pouvoir Mythique Laser Oculaire + Dragonnet Mythique + ressources |
| Pack Débutant | 0,99 €, « +900 % de valeur », proposé en pop‑up à l'étape 1‑9 |
| Offres du jour / de la semaine | 3 + 2 packs réinitialisés automatiquement |
| Packs costumes | Ninja 9,99 €, Cyber Sphynx 49,99 €, **Méga Baleine 99,99 €** (Empereur Cosmique, +75 % ATQ) |
| Offre flash | Proposée après 2 défaites d'affilée (1 h, version « Ultime » pour les payeurs) |
| Cartes | Mensuelle 4,99 €, Royale à vie 24,99 €, Fonds de croissance 9,99 € |
| Passe Royal | 30 paliers gratuits/premium, Deluxe +10 paliers |
| VIP 0 → 15 | Points = € dépensés. Jusqu'à **+120 % ATQ/PV**, vitesse ×3, ouverture ×50, 4e pouvoir, 3e compagnon, costumes exclusifs (VIP 8 et 12) |

### Équilibrage (simulateur `npm run sim`)

Joueur optimal sur 30 jours (résultats de `scripts/sim.mjs`) :

| Profil | Dépense | Jour 1 | Jour 7 | Jour 30 | Puissance J30 |
|---|---|---|---|---|---|
| Gratuit | 0 € | 9‑10 | 18‑9 | 26‑2 | ~1,8 B |
| Petit payeur | ~106 € | 13‑10 | 21‑5 | 30‑1 | ~14 B |
| Baleine | ~4 400 € | 24‑5 | 31‑10 | 43‑10 | ~67 T |

Le joueur gratuit progresse en continu : il a toujours des étapes à franchir, des gemmes gratuites (tour, arène, objectifs, quêtes) et l'ouverture automatique au niveau 25. La baleine domine largement l'arène et le classement, et c'est voulu. Toutes les valeurs se règlent dans `src/config.js`.

## Mettre le jeu sur téléphone (Android / iOS)

Avec [Capacitor](https://capacitorjs.com) (déjà configuré dans `capacitor.config.json`) :

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap add android
npx cap add ios
npx cap sync
npx cap open android
```

Android Studio (ou Xcode sur Mac pour iOS) génère ensuite l'APK / l'IPA à publier.

## Avant une vraie sortie en magasin

- **Paiements réels** : remplacer `purchase()` dans `src/main.js` par Google Play Billing / StoreKit (par exemple RevenueCat ou `cordova-plugin-purchase`), avec **validation des reçus côté serveur**.
- **Serveur** : la sauvegarde est locale (localStorage), donc facile à tricher. Il faut un backend pour la sauvegarde cloud, l'économie sécurisée, la vraie arène et les classements (aujourd'hui des bots simulés).
- **Publicités** : brancher AdMob / AppLovin à la place des vidéos simulées.
- **Légal** : les probabilités sont déjà affichées (obligatoire sur l'App Store et Google Play). À vérifier aussi : le classement d'âge, les règles sur les « loot boxes » payantes (interdites en Belgique, encadrées ailleurs), les limites de dépenses et le contrôle parental pour les mineurs.
- **Polices** : elles sont chargées depuis Google Fonts. Pour une appli 100 % hors‑ligne, les embarquer dans `dist/`.

## Structure

```
src/config.js      tables d'équilibrage (raretés, coûts, offres, VIP, quêtes…)
src/state.js       sauvegarde, remises à zéro quotidiennes, bots d'arène
src/stats.js       calcul des statistiques et de la puissance
src/economy.js     tirages, carton, récompenses
src/combat.js      formules de combat + simulation rapide
src/encounters.js  vagues de la campagne, des donjons et de la tour
src/battle.js      combat temps réel (3D)
src/three/         monde, modèles procéduraux, effets visuels, icônes 3D
src/ui/            interface, panneaux, icônes SVG
src/audio.js       sons et musique synthétisés (aucun fichier audio)
scripts/sim.mjs    simulateur d'économie gratuit / petit payeur / baleine
```
