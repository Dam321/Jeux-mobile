# Miaou Empire

Jeu mobile « idle RPG » en 2D cartoon, vue de côté, dans l'esprit de Legend of Mushroom. Le joueur incarne Minou, un chat entièrement personnalisable, suivi de ses bébés chats. Il combat automatiquement des rats, des chiens, des aspirateurs robots, des crabes, des yétis, des ovnis… Il ouvre le **carton magique** pour s'équiper, fabrique des panoplies, forge son équipement, commerce à l'hôtel des ventes et fait la guerre aux autres clans de chats.

Les personnages, les objets, les ennemis, les décors et l'interface sont originaux, dessinés par le code (aucune image externe).

## Lancer le jeu

```bash
npm install
npm run build      # produit dist/index.html (jeu complet en un seul fichier)
npm run serve      # http://localhost:8080 — ouvrir aussi depuis un téléphone sur le même Wi‑Fi
```

## Ce qu'il y a dans le jeu (v5)

| Système | Contenu |
|---|---|
| Effets | Chaque pouvoir a sa signature (éclairs ramifiés, météore et cratère, galaxie qui explose, patte fantôme du tigre…), avec charge, impact, onde de choc et traces au sol. Chaque élément de chaton a son impact. Les noms de pouvoir s'affichent en petit médaillon, sans cacher le combat |
| Rendu | Canvas 2D vectoriel en « cel-shading » (contour épais, ombre franche, reflet) : 14 décors en parallaxe, chacun en 4 ambiances d'ère. Particules additives, ralenti à l'impact, zoom, tremblements, bandeaux d'attaque, carte d'entrée des boss |
| Classes | 6 classes de chat, chacune avec sa tenue, son style d'attaque, son coup final et **ses propres armes et armures** : Chat Botté (épéiste), Chat Noir (mage), Chat Tigré (berserker), Chat Ninja (assassin), Chat Siamois (chasseur), Chat Sphynx (faucheur). 2 spécialisations par classe au niveau 25 (parade, malédiction, rage, poison, tir multiple, exécution, âmes…). Premier changement gratuit, ensuite en gemmes. Équilibrées au simulateur : ±1 % d'écart |
| Maps | Une map = 10 étapes et un décor. Les monstres arrivent peu à peu (2 espèces au début, la 3e à partir de x-4, grands groupes et élites en x-7 à x-9), mini-boss en x-5, **boss de map en x-10** puis nouveau décor et nouveaux monstres. Chaque boss vaincu donne une récompense qui grandit avec la map. La difficulté augmente sans fin |
| Ères | Après les 14 maps, le cycle reprend en Crépuscule, puis Cauchemar, Infernal, Infernal II, III… Décors et monstres changent de couleur, des élites apparaissent, le butin est multiplié (+35 % par ère) et des essences d'ère tombent |
| Monstres | 28 ennemis et 14 boss au design unique, avec 4 variantes d'ère chacun. Les boss ont des attaques spéciales (onde de choc, barrage, invocation, drain de vie) et entrent en rage à 30 % de PV |
| Animation | Le chat et ses 40 chatons vivent tout seuls : respiration, oreilles et queue animées, clignements, scènes d'attente (bâillement, toilette, étirement, coucou, petit saut), 13 expressions pour le héros, 8 pour chaque chaton, réactions aux coups et pose de victoire. Plus un chaton est rare, plus il brille (étincelles, cercles magiques, arc-en-ciel) |
| Chat principal | Personnalisable : 19 pelages, 9 motifs + couleur, 10 couleurs d'yeux (et yeux vairons), 4 regards, 4 types d'oreilles, 3 queues, 20 costumes, 16 auras, 20 titres, 11 cadres d'avatar. Chaque style possédé donne un bonus permanent (ATQ, PV ou butin) |
| Équipement | 10 emplacements, plus de 60 apparences d'objets, 9 raretés. L'équipement porté se voit sur le chat |
| Bébés chats | 40 chatons, chacun avec un design et une attaque uniques (pluie d'étoiles, tornade, laser, météores…). Ultime à partir de Mythique. Panier avec garantie, chaton vedette de la semaine (50 % du tirage de sa rareté), chatons sauvages en combat |
| Artefacts | 20 artefacts : niveaux illimités, jusqu'à 10 étoiles, 4 à 6 emplacements selon le VIP. Fragments : boss, Tour, coffre, boutiques |
| Tour des Défis | Étages infinis, difficulté sans plafond, puissance conseillée par étage, **classement de 100 joueurs** (les rivaux grimpent chaque jour) avec récompense hebdomadaire et titre « Maître de la Tour » pour le n°1. Un modificateur par étage (Nuée, Silence, Géant, Contre-la-montre…), un gardien tous les 10 étages, récompenses à chaque étage, cosmétiques exclusifs aux paliers 10 → 500 puis tous les 100 étages. Récompense quotidienne selon le record, boutique à jetons, second souffle payant en gemmes |
| Guildes | 20 guildes rivales (ou la vôtre, à fonder). Présence, dons d'or et de gemmes, niveau de guilde. **Boss de guilde** à PV partagés : chaque Gardien vaincu donne un coffre à tous et un Gardien plus fort arrive. **Classement des membres** au meilleur assaut de la semaine, **classement inter-guildes** aux dégâts cumulés, récompense hebdomadaire pour chaque membre. **Arbre de guilde** : 12 bonus sur 4 paliers (ATQ, PV, or, critique, butin AFK, dégâts aux boss, chatons, butin, pouvoirs, vitesse), achetés avec les écussons et actifs seulement en guilde. Boutique de guilde (aura « Étendard », cadre « Blason »). La Guerre des Gouttières se joue sous les couleurs de votre guilde |
| Festival de la semaine | Un événement différent chaque semaine (Herbe à Chat, Lanternes, Grande Pêche, Carnaval) : tout rapporte des points (combats, cartons, étapes, boss, Tour, assauts, arène, gemmes dépensées). 10 paliers jusqu'à une aura, un cadre et un titre exclusifs, boutique de lanternes, Pack du Festival |
| Bestiaire | 42 espèces (28 monstres, 14 boss) avec 4 paliers de chasse chacune : chaque palier donne +0,2 % ATQ et PV pour toujours, plus de l'or et des gemmes |
| Boss mondial | Un Titan différent chaque jour : 30 secondes pour lui infliger un maximum de dégâts. Classement du jour, récompense selon le rang, tickets supplémentaires en gemmes |
| AFK | Coffre AFK plafonné à 12 h (jusqu'à 24 h en VIP) : or, pelotes, XP et butin des monstres de la map. Patrouille éclair : 2 h de butin tout de suite (1 gratuite par jour, puis en gemmes). Mode AFK : écran d'économie d'énergie, sessions de 2 h et plus en VIP |
| Repaires des Boss | Rejouer les boss de map déjà vaincus pour leur matériau de craft : 3 tickets par jour, plus des tickets en gemmes |
| Atelier | 19 panoplies à fabriquer (bonus de 2 à 8 pièces), métier d'artisan. Alchimie : 5 potions et transmutation des ressources. Les statistiques des objets fabriqués sont tirées au hasard, le jet parfait est rare |
| Forgemagie | Objets de +1 à +15 : 95 % de réussite pour le premier niveau, 4 % pour le dernier. Au-delà de +7, un échec fait perdre un niveau, sauf avec une Pierre de protection |
| Hôtel des ventes | Inspiré de Dofus : lots de 1, 10 et 100. Les prix bougent selon l'offre et la demande, il y a une taxe de 2 %, l'historique des prix, des ventes hors ligne et un bureau de change gemmes ↔ or |
| PvP | Arène de 100 joueurs en 7 divisions, avec saison hebdomadaire. Guerre des Gouttières : 4 clans se disputent 12 toits de la ville |
| Carton évolutif | Le carton magique évolue en 10 étapes avec son niveau : carton abîmé, carton renforcé, caisse en bois, panier en osier, coffre peint, maisonnette de chat, chatière dorée, pavillon royal, château de cristal, palais céleste de Bastet. Révélation à chaque étape. À l'ouverture : gerbe de particules à la couleur de la rareté, et pour Légendaire et plus un suspense, un faisceau de lumière et un tampon géant |
| Interface | Barre d'icônes en haut, informations empilées dans le bandeau, commandes posées sur le sol, monstres tenus à distance : rien ne cache les combattants ni les sorts. Les images des panneaux se dessinent en arrière-plan, sans figer l'écran. Carton plus compact, avec suspense, faisceau de lumière et tampon géant pour les grandes raretés |

## Monétisation (achats simulés)

| Levier | Contenu |
|---|---|
| Gemmes | 6 paliers de 0,99 € à 99,99 €, doublées au premier achat de chaque palier. Les gemmes gratuites sont volontairement rares |
| Coffre des Reliques | 10 reliques uniques à effet spécial. 0,25 % par tirage, garantie à 300 tirages. Une relique peut aussi sortir d'un carton, à 1 chance sur 200 000 |
| Coffre d'artefacts | 120 gemmes (1 080 pour 10), 1 tirage gratuit par jour |
| Boutique de style | Auras, cadres et costumes contre des gemmes, avec un bonus de collection permanent |
| Récompenses de fidélité | 9 paliers de 5 € à 5 000 € de dépense cumulée : cadres, auras, artefacts, chatons, reliques |
| Packs et offres | Pack du Festival (chaque semaine), Pack Débutant, Panier Royal, Ninja, Cyber, Méga Baleine (99,99 €), Kit du Forgeron, Trèfles, offres du jour et de la semaine, offre flash après 2 défaites |
| Abonnements | Carte mensuelle, **carte Sans Pub à vie** (4,99 € : les vidéos bonus deviennent instantanées, 10 par jour au lieu de 8), fonds de croissance, Passe Royal. La carte à vie qui donnait 1 000 gemmes a été retirée |
| Autel de Bastet | Niveaux infinis achetés en gemmes : +1 % ATQ et PV par niveau, un trésor tous les 10 niveaux, coût +7,5 % par niveau (environ 29 000 gemmes pour le niveau 50, 1,1 million pour le niveau 100) |
| VIP 0 → 20 | Jusqu'à +270 % ATQ/PV (VIP 16 à 20 de 15 000 € à 100 000 € cumulés), butin jusqu'à +100 %, 5 chatons et 6 artefacts équipés, vitesse x3, achats de tickets supplémentaires |
| Bureau de change | Les gemmes se vendent contre de l'or, ce qui permet aux baleines d'acheter tout le marché. Les joueurs gratuits peuvent aussi acheter jusqu'à 100 gemmes par jour avec leur or |
| Dépenses en gemmes | Coffres, fondation de guilde et dons, assauts de Gardien supplémentaires, changement de classe et de spécialisation, tickets de repaire et de Boss mondial, patrouilles éclair, clés de donjon, second souffle de la Tour, accélérations, apparence, style |

### Équilibrage (simulateur `npm run sim`)

Joueur optimal sur 30 jours (le simulateur ne modélise ni le marché, ni la Tour, ni les artefacts, ni les guildes, ni le Festival : un vrai joueur avance un peu plus vite) :

| Profil | Dépense | Jour 1 | Jour 7 | Jour 30 | Ère au J30 | Puissance J30 | Chatons J30 |
|---|---|---|---|---|---|---|---|
| Gratuit | 0 € | 9‑7 | 18‑4 | 25‑5 | Crépuscule | ~1,3 B | 29/40 |
| Petit payeur | ~106 € | 14‑5 | 20‑7 | 29‑5 | Crépuscule | ~12 B | 29/40 |
| Baleine | ~4 700 € | 24‑7 | 30‑8 | 43‑1 | Infernal | ~54 T | 37/40 |

Sur la durée, la progression ralentit pour tout le monde (gratuit : map 25 → 30 → 33 aux jours 30, 60 et 90 ; baleine : 42 → 51 → 58). Avancer vite ne rend donc jamais le jeu « trop facile » et l'achat garde son intérêt.

La baleine est environ 40 000 fois plus puissante au jour 30 et domine l'arène et la guerre. Le joueur gratuit progresse en continu, plus lentement. Toutes les valeurs se règlent dans `src/config.js`, `src/content.js` et `src/content3.js`.

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

- **Serveur (indispensable)** : l'hôtel des ventes, l'arène, la Guerre des Gouttières, les guildes et tous les classements sont aujourd'hui simulés avec des joueurs virtuels. Un vrai jeu en ligne a besoin d'un backend, qui gère aussi la sauvegarde cloud et protège l'économie contre la triche.
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
src/altar.js       Autel de Bastet (progression infinie)
src/classes.js     classes de chat, spécialisations, armes et armures réservées
src/encounters.js  vagues de la campagne, des donjons, des repaires, du Boss mondial et de la Tour
src/state.js       sauvegarde (migration v2 → v3), remises à zéro quotidiennes, bots PvP
src/stats.js       statistiques (équipement, panoplies, reliques, chatons, costumes, VIP)
src/economy.js     carton, butin, craft, forgemagie, brisage, reliques, gacha
src/market.js      hôtel des ventes + bureau de change
src/pvp.js         arène, Guerre des Gouttières, classements de la Tour et du Boss mondial
src/guild.js       guildes : niveaux, dons, boss de guilde, classements, arbre, boutique
src/event.js       Festival de la semaine et Bestiaire
src/battle.js      combat 2D (campagne, donjons, tour, arène, guerre)
src/gfx/           dessin : carton évolutif (boxart.js), chat et tenues de classe, chatons, équipement, ennemis et boss (bestiary.js), décors, effets, attaques, coups finaux de classe (classfx.js)
src/ui/            interface, panneaux, classes (classui.js), guildes (guildui.js), Festival et Bestiaire (eventui.js), images différées (lazy.js), icônes SVG
scripts/sim.mjs    simulateur d'économie gratuit / petit payeur / baleine (npm run sim)
scripts/classes.mjs équilibrage des 12 spécialisations (npm run sim:classes)
```
