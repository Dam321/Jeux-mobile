# Miaou Empire

Jeu mobile « idle RPG » en 2D cartoon, vue de côté, dans l'esprit de Legend of Mushroom. Le joueur incarne Minou, un chat entièrement personnalisable, suivi de ses bébés chats. Il combat automatiquement des rats, des chiens, des aspirateurs robots, des crabes, des yétis, des ovnis… Il ouvre le **carton magique** pour s'équiper, fabrique des panoplies, forge son équipement, commerce à l'hôtel des ventes et fait la guerre aux autres clans de chats.

Les personnages, les objets, les ennemis, les décors et l'interface sont originaux, dessinés par le code (aucune image externe).

## Lancer le jeu

```bash
npm install
npm run build      # produit dist/index.html (jeu complet en un seul fichier)
npm run serve      # http://localhost:8080 — ouvrir aussi depuis un téléphone sur le même Wi‑Fi
```

## Ce qu'il y a dans le jeu (v3)

| Système | Contenu |
|---|---|
| Rendu | Canvas 2D vectoriel en « cel-shading » (contour épais, ombre franche, reflet) : 14 décors en parallaxe, chacun en 4 ambiances d'ère. Particules additives, ralenti à l'impact, zoom, tremblements, bandeaux d'attaque, carte d'entrée des boss |
| Maps | Une map = 10 étapes. Mini-boss à l'étape 5, **boss de map à l'étape 10**. La difficulté augmente à chaque étape, sans fin |
| Ères | Après les 14 maps, le cycle reprend en Crépuscule, puis Cauchemar, Infernal, Infernal II, III… Décors et monstres changent de couleur, des élites apparaissent, le butin est multiplié (+35 % par ère) et des essences d'ère tombent |
| Monstres | 28 ennemis et 14 boss au design unique, avec 4 variantes d'ère chacun. Les boss ont des attaques spéciales (onde de choc, barrage, invocation, drain de vie) et entrent en rage à 30 % de PV |
| Chat principal | Personnalisable : 19 pelages, 9 motifs + couleur, 10 couleurs d'yeux (et yeux vairons), 4 regards, 4 types d'oreilles, 3 queues, 20 costumes, 14 auras, 17 titres, 9 cadres d'avatar. Chaque style possédé donne un bonus permanent (ATQ, PV ou butin) |
| Équipement | 10 emplacements, plus de 60 apparences d'objets, 9 raretés. L'équipement porté se voit sur le chat |
| Bébés chats | 40 chatons, chacun avec un design et une attaque uniques (pluie d'étoiles, tornade, laser, météores…). Ultime à partir de Mythique. Panier avec garantie, chaton vedette de la semaine (50 % du tirage de sa rareté), chatons sauvages en combat |
| Artefacts | 20 artefacts : niveaux illimités, jusqu'à 10 étoiles, 4 à 6 emplacements selon le VIP. Fragments : boss, Tour, coffre, boutiques |
| Tour des Défis | Étages infinis. Un modificateur par étage (Nuée, Silence, Géant, Contre-la-montre…), un gardien tous les 10 étages, récompenses à chaque étage, cosmétiques exclusifs aux paliers 10 → 500 puis tous les 100 étages. Récompense quotidienne selon le record, boutique à jetons, second souffle payant en gemmes |
| Repaires des Boss | Rejouer les boss de map déjà vaincus pour leur matériau de craft : 3 tickets par jour, plus des tickets en gemmes |
| Atelier | 19 panoplies à fabriquer (bonus de 2 à 8 pièces), métier d'artisan. Alchimie : 5 potions et transmutation des ressources. Les statistiques des objets fabriqués sont tirées au hasard, le jet parfait est rare |
| Forgemagie | Objets de +1 à +15 : 95 % de réussite pour le premier niveau, 4 % pour le dernier. Au-delà de +7, un échec fait perdre un niveau, sauf avec une Pierre de protection |
| Hôtel des ventes | Inspiré de Dofus : lots de 1, 10 et 100. Les prix bougent selon l'offre et la demande, il y a une taxe de 2 %, l'historique des prix, des ventes hors ligne et un bureau de change gemmes ↔ or |
| PvP | Arène de 100 joueurs en 7 divisions, avec saison hebdomadaire. Guerre des Gouttières : 4 clans se disputent 12 toits de la ville |
| Interface | Barre d'icônes en haut, informations empilées dans le bandeau, commandes posées sur le sol : rien ne cache les combattants. Le tutoriel entoure le bouton à toucher |

## Monétisation (achats simulés)

| Levier | Contenu |
|---|---|
| Gemmes | 6 paliers de 0,99 € à 99,99 €, doublées au premier achat de chaque palier. Les gemmes gratuites sont volontairement rares |
| Coffre des Reliques | 10 reliques uniques à effet spécial. 0,25 % par tirage, garantie à 300 tirages. Une relique peut aussi sortir d'un carton, à 1 chance sur 200 000 |
| Coffre d'artefacts | 120 gemmes (1 080 pour 10), 1 tirage gratuit par jour |
| Boutique de style | Auras, cadres et costumes contre des gemmes, avec un bonus de collection permanent |
| Récompenses de fidélité | 9 paliers de 5 € à 5 000 € de dépense cumulée : cadres, auras, artefacts, chatons, reliques |
| Packs et offres | Pack Débutant, Panier Royal, Ninja, Cyber, Méga Baleine (99,99 €), Kit du Forgeron, Trèfles, offres du jour et de la semaine, offre flash après 2 défaites |
| Abonnements | Carte mensuelle, **carte Sans Pub à vie** (4,99 € : les vidéos bonus deviennent instantanées, 10 par jour au lieu de 8), fonds de croissance, Passe Royal. La carte à vie qui donnait 1 000 gemmes a été retirée |
| VIP 0 → 15 | Jusqu'à +120 % ATQ/PV, butin +75 %, 5 chatons et 6 artefacts équipés, vitesse x3, achats de tickets supplémentaires |
| Bureau de change | Les gemmes se vendent contre de l'or, ce qui permet aux baleines d'acheter tout le marché. Les joueurs gratuits peuvent aussi acheter jusqu'à 100 gemmes par jour avec leur or |
| Dépenses en gemmes | Coffres, tickets de repaire, clés de donjon, second souffle de la Tour, accélérations, apparence, style |

### Équilibrage (simulateur `npm run sim`)

Joueur optimal sur 30 jours (le simulateur ne modélise ni le marché, ni la Tour, ni les artefacts) :

| Profil | Dépense | Jour 1 | Jour 7 | Jour 30 | Ère au J30 | Puissance J30 | Chatons J30 |
|---|---|---|---|---|---|---|---|
| Gratuit | 0 € | 9‑5 | 17‑4 | 24‑9 | Crépuscule | ~0,9 B | 24/40 |
| Petit payeur | ~106 € | 13‑10 | 20‑6 | 28‑10 | Crépuscule | ~9 B | 31/40 |
| Baleine | ~4 700 € | 25‑8 | 31‑6 | 43‑8 | Infernal | ~51 T | 37/40 |

La baleine est environ 57 000 fois plus puissante au jour 30 et domine l'arène et la guerre. Le joueur gratuit progresse en continu, plus lentement. Toutes les valeurs se règlent dans `src/config.js`, `src/content.js` et `src/content3.js`.

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
src/content.js     chatons, apparence, costumes, ressources, boss de map, panoplies, forge, reliques, marché, guerre
src/content3.js    ères, artefacts, auras, titres, cadres, potions, Tour des Défis, fidélité
src/encounters.js  vagues de la campagne, des donjons, des repaires et de la Tour
src/state.js       sauvegarde (migration v2 → v3), remises à zéro quotidiennes, bots PvP
src/stats.js       statistiques (équipement, panoplies, reliques, chatons, costumes, VIP)
src/economy.js     carton, butin, craft, forgemagie, brisage, reliques, gacha
src/market.js      hôtel des ventes + bureau de change
src/pvp.js         arène classée + Guerre des Gouttières
src/battle.js      combat 2D (campagne, donjons, tour, arène, guerre)
src/gfx/           dessin : chat, chatons, équipement, ennemis et boss (bestiary.js), décors, effets, attaques
src/ui/            interface, panneaux, icônes SVG
scripts/sim.mjs    simulateur d'économie gratuit / petit payeur / baleine
```
