# Miaou Empire

Jeu mobile « idle RPG » en 2D cartoon, vue de côté, dans l'esprit de Legend of Mushroom. Le joueur incarne Minou, un chat entièrement personnalisable, suivi de ses bébés chats. Il combat automatiquement des rats, des chiens, des aspirateurs robots, des crabes, des yétis, des ovnis… Il ouvre le **carton magique** pour s'équiper, fabrique des panoplies, forge son équipement, commerce à l'hôtel des ventes et fait la guerre aux autres clans de chats.

Les personnages, les objets, les ennemis, les décors et l'interface sont originaux, dessinés par le code (aucune image externe).

## Lancer le jeu

```bash
npm install
npm run build      # produit dist/index.html (jeu complet en un seul fichier, ~430 Ko)
npm run serve      # http://localhost:8080 — ouvrir aussi depuis un téléphone sur le même Wi‑Fi
```

## Ce qu'il y a dans le jeu (v2)

| Système | Contenu |
|---|---|
| Rendu | Canvas 2D vectoriel : 9 décors en parallaxe (jardin, automne, plage, neige, ville néon, volcan, cosmos, toits de Paris, arène), particules additives, ralenti à l'impact, zoom, tremblements, bandeau d'attaque spéciale |
| Chat principal | Personnalisable : 19 pelages, 9 motifs + couleur, 10 couleurs d'yeux (et yeux vairons), 4 regards, 4 types d'oreilles, 3 queues. L'équipement porté se voit sur le chat |
| Équipement | 10 emplacements (arme, chapeau, visage, armure, cape, dos, gants, bottes, collier, anneau). Plus de 60 apparences d'objets (12 armes avec chacune son style d'attaque) et 9 raretés |
| Bébés chats | 40 chatons de 8 éléments (feu, glace, foudre, nature, eau, ombre, lumière, cosmos), chacun avec son attaque. Ultime à partir de Mythique. Le Panier (gacha) a une garantie (pity), et des chatons sauvages se trouvent en combat |
| Ennemis | 14 ennemis et 7 boss de biome. Ils lâchent 40 ressources, dont des ultra-rares (Larme de Bastet : 0,0015 % par ennemi) |
| Atelier | 9 panoplies à fabriquer avec bonus de 2 à 8 pièces, et un métier d'artisan. Les statistiques des objets fabriqués sont tirées au hasard, le jet parfait est rare |
| Forgemagie | Objets de +1 à +15 : 95 % de réussite pour le premier niveau, 4 % pour le dernier. Au-delà de +7, un échec fait perdre un niveau, sauf avec une Pierre de protection. Les runes s'obtiennent en brisant des objets |
| Hôtel des ventes | Inspiré de Dofus : lots de 1, 10 et 100. Les prix bougent selon l'offre et la demande, il y a une taxe de 2 %, l'historique des prix, des ventes hors ligne et un bureau de change gemmes ↔ or |
| PvP | Arène de 100 joueurs en 7 divisions, avec saison hebdomadaire. Guerre des Gouttières : 4 clans se disputent 12 toits de la ville, avec gardiens, points par heure, tribut quotidien et boutique de guerre |
| Sans fin | Étapes, tour, niveaux de héros, d'artisan et de chatons sans limite, forgemagie, saisons hebdomadaires |

## Monétisation (achats simulés)

| Levier | Contenu |
|---|---|
| Gemmes | 6 paliers de 0,99 € à 99,99 €, doublées au premier achat de chaque palier |
| Coffre des Reliques | 10 reliques uniques à effet spécial, dont le niveau suit le héros. 0,25 % par tirage (0,025 % pour une relique précise), garantie à 300 tirages. Une relique peut aussi sortir d'un carton, à 1 chance sur 200 000 |
| Raretés extrêmes | Primordial à 0,009 % au carton niveau max, chatons Primordiaux à 0,001 % |
| Packs | Pack Débutant, Panier Royal (chaton Mythique garanti), Ninja, Cyber, Méga Baleine (99,99 €), Kit du Forgeron, Trèfles (butin x2), Coffre du Collectionneur |
| Offres | 3 offres du jour, 4 de la semaine, offre flash après 2 défaites, bonus de premier achat |
| Abonnements | Carte mensuelle, carte à vie, fonds de croissance, Passe Royal |
| VIP 0 → 15 | Jusqu'à +120 % ATQ/PV, butin +75 %, 5 chatons équipés, 38 emplacements de vente, vitesse x3, costumes exclusifs |
| Apparence | Pelages, motifs et yeux premium à débloquer avec des gemmes |
| Bureau de change | Les gemmes se vendent contre de l'or, ce qui permet aux baleines d'acheter tout le marché. Les joueurs gratuits peuvent aussi acheter jusqu'à 100 gemmes par jour avec leur or |

### Équilibrage (simulateur `npm run sim`)

Joueur optimal sur 30 jours (le simulateur ne modélise pas le marché) :

| Profil | Dépense | Jour 1 | Jour 7 | Jour 30 | Puissance J30 | Chatons J30 |
|---|---|---|---|---|---|---|
| Gratuit | 0 € | 9‑10 | 17‑5 | 24‑10 | ~0,8 B | 26/40 |
| Petit payeur | ~106 € | 14‑5 | 20‑10 | 29‑4 | ~10 B | 28/40 |
| Baleine | ~4 700 € | 24‑6 | 31‑4 | 42‑10 | ~44 T | 36/40 |

La baleine est environ 50 000 fois plus puissante au jour 30 et domine l'arène et la guerre. Le joueur gratuit progresse en continu : gemmes gratuites (tour, arène, objectifs, quêtes), vente de ressources à l'hôtel des ventes, gemmes achetables avec de l'or. Toutes les valeurs se règlent dans `src/config.js` et `src/content.js`.

## Mettre le jeu sur téléphone (Android / iOS)

Avec [Capacitor](https://capacitorjs.com) (déjà configuré dans `capacitor.config.json`) :

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap add android
npx cap sync
npx cap open android
```

## Avant une vraie sortie en magasin

- **Serveur (indispensable)** : l'hôtel des ventes, l'arène, la Guerre des Gouttières et le classement sont aujourd'hui simulés avec des joueurs virtuels. Un vrai jeu en ligne a besoin d'un backend, qui gère aussi la sauvegarde cloud et protège l'économie contre la triche.
- **Paiements réels** : brancher Google Play Billing / StoreKit (par exemple RevenueCat) à la place de `purchase()` dans `src/main.js`, avec validation des reçus côté serveur.
- **Publicités** : brancher AdMob ou AppLovin à la place des vidéos simulées.
- **Légal** :
  - Déjà en place : les probabilités de chaque tirage (carton, chatons, pouvoirs, reliques, forgemagie) sont affichées, une limite de dépenses mensuelle est réglable, et la monnaie du jeu ne peut pas être reconvertie en argent réel.
  - Reste à vérifier : le classement d'âge (PEGI), l'interdiction des « loot boxes » payantes en Belgique, les règles de protection des mineurs, et les règles Apple et Google sur les objets aléatoires payants.
- **Polices** : elles sont chargées depuis Google Fonts. Pour une appli 100 % hors ligne, il faut les embarquer dans `dist/`.

## Structure

```
src/config.js      équilibrage : raretés, carton, 10 emplacements, VIP, boutique, quêtes, arène
src/content.js     chatons, apparence, costumes, ressources, panoplies, forge, reliques, marché, guerre
src/state.js       sauvegarde v2, remises à zéro quotidiennes, bots PvP
src/stats.js       statistiques (équipement, panoplies, reliques, chatons, costumes, VIP)
src/economy.js     carton, butin, craft, forgemagie, brisage, reliques, gacha
src/market.js      hôtel des ventes + bureau de change
src/pvp.js         arène classée + Guerre des Gouttières
src/battle.js      combat 2D (campagne, donjons, tour, arène, guerre)
src/gfx/           dessin : chat et chatons, équipement, ennemis, décors, effets, attaques
src/ui/            interface, panneaux, icônes SVG
scripts/sim.mjs    simulateur d'économie gratuit / petit payeur / baleine
```
