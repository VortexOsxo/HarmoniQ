# Manuel d'Utilisation - HarmoniQ

HarmoniQ est un outil de simulation et de planification énergétique pour le Québec, conçu pour modéliser l’avenir énergétique de la province. Il permet d’explorer différents scénarios énergétiques en construisant votre propre parc énergétique et en analysant les coûts, les émissions et la production d’énergie. La plateforme interactive vous permet de tester diverses configurations de production (éolien, solaire, hydroélectricité, nucléaire, etc.) afin d’observer leur impact sur les coûts, les émissions de CO₂ et la production du réseau. Ce guide vous aidera à naviguer dans l’application, à configurer vos scénarios et à interpréter les résultats.

---

## 1. Navigation dans l'application

La navigation se fait à partir de la barre de navigation située en haut de l'écran. Elle vous permet d'accéder aux différentes pages de l'application.

### Pages d'information
*   **À Propos** : Présentation du projet, de l'objectif et des technologies utilisées.
*   **Documentation** : Documentation technique des modules de calcul (éolien, hydro, solaire, thermique, nucléaire).
*   **Aide** : Disponible uniquement sur la page Simulation, ce bouton lance un tutoriel guidé qui vous explique chaque élément de l'interface étape par étape.

### Page Simulation (Carte)
C'est votre espace de travail principal. Cette page affiche une carte interactive du Québec sur laquelle sont positionnées les infrastructures énergétiques (barrages, éoliennes, centrales solaires, etc.). C'est ici que vous :
*   Explorez la géographie du Québec
*   Sélectionnez un scénario (année 2035 ou 2050)
*   Choisissez et personnalisez un groupe d'infrastructures
*   Activez des calques visuels (aires protégées, réseau électrique, carte des vents)
*   Lancez une simulation en cliquant sur le bouton Lancer Simulation

<p align="center">
  <img src="../docs/images/page_simulation.png" width="800" />
</p>

### Page Résultats (Tableau de bord)
Après avoir lancé une simulation, vous êtes redirigé automatiquement vers cette page. Elle présente un tableau de bord complet avec plusieurs graphiques interactifs qui vous permettent de :
*   Comparer les coûts de votre mix énergétique (OPEX et CAPEX)
*   Visualiser les émissions de CO₂ par source d'énergie
*   Suivre l'évolution de la production et de la demande heure par heure
*   Identifier les infrastructures les plus rentables et les plus productives
*   Exporter les données au format CSV pour une analyse externe

<p align="center">
  <img src="../docs/images/page_resultats.png" width="800" />
</p>


---

## 2. Configurer votre Scénario (Page Simulation)

La page Simulation est votre espace de travail principal pour définir votre mix énergétique.

### A. Utiliser la Carte Interactive
*   Déplacement : Cliquez et glissez pour vous déplacer sur la carte du Québec. Utilisez la molette de la souris pour zoomer.
*   Calques (Boutons en haut à gauche) : 
    *   Infrastructures : Affiche les centrales et parcs énergétiques sur la carte.
    *   Aires protégées : Affiche les zones protégées.
    *   Réseau : Affiche les lignes de transport d'électricité existantes.
    *   Carte des vents : Affiche les vitesses moyennes des vents sur la carte.
*   Paramètres (Icône roue dentée) : Sur chaque bouton de calque, vous pouvez filtrer ce que vous voyez (ex: ne voir que l'éolien).

<p align="center">
  <img src="../docs/images/carte_interactive.png" width="800" />
</p>

*   Créer de nouvelles infrastructures : En bas à droite de l'écran, vous trouverez une barre d'outils permettant d'ajouter des infrastructures par glisser-déposer (drag and drop).
    1. Faites glisser l'icône du type d'énergie souhaité (éolien, solaire, thermique ou nucléaire) directement sur la carte à l'endroit de votre choix.
    3. Une fois l'emplacement choisi, un formulaire s'ouvre pour définir le nom, la puissance et les caractéristiques techniques de l'infrastructure.
    4. Cliquez sur Créer pour l'ajouter officiellement à votre scénario.

    Exception pour les barrages : Pour l'hydroélectricité, vous devez choisir un barrage parmi une liste prédéfinie. Ces barrages viennent avec leurs propres informations techniques et capacités déjà renseignées, contrairement aux autres sources que vous configurez de zéro.

<p align="center">
  <img src="../docs/images/ajout.png" width="500" />
  <br />
  <em>Barre d'outils pour l'ajout d'infrastructures</em>
</p>

<p align="center">
  <img src="../docs/images/modal_eolien.png" width="450" />
  <br />
  <em>Formulaire de configuration d'un parc éolien</em>
</p>


### B. Le Panneau Sources d'Énergie
Cliquez sur le bouton flottant Sources d'Énergie pour ouvrir le panneau de configuration détaillé.

<p align="center">
  <img src="../docs/images/source_energie.png" width="500" />
</p>

Ce panneau vous permet de définir le contexte de votre simulation et de gérer vos installations.

*   Scénario Actif : C'est ici que vous définissez le cadre temporel et environnemental.
    *   Choix du scénario : Sélectionnez une année de référence (ex: 2035 ou 2050).
    *   Consommation : Indique le niveau de demande électrique attendu (Normal, Haut, etc.).
    *   Météo : Détermine les conditions climatiques (Typique, Froide, etc.) qui influenceront la production éolienne et solaire ainsi que la demande.

*   Groupe Infras Actif : Un groupe est une collection d'infrastructures que vous pouvez activer ou désactiver.
    *   Gestion des groupes : Vous pouvez basculer entre différents groupes (ex: Infrastructures existantes vs Nouveau projet éolien) ou en créer un nouveau avec le bouton +.
    *   Filtrage et Recherche : Utilisez les boutons de filtres (Hyd, Éol, Sol, etc.) ou la barre de recherche pour trouver rapidement une installation spécifique dans votre liste.
    *   Sélection : Vous pouvez sélectionner ou désélectionner individuellement chaque infrastructure pour l'inclure ou non dans le calcul final.


### C. Lancer la Simulation
Une fois satisfait de votre configuration, cliquez sur le bouton vert Lancer la simulation. L'application lancera alors la simulation et vous déplacera vers la page de résultats.

---

## 3. Interpréter les Résultats

### A. Les Graphiques du Tableau de Bord

Les résultats sont organisés en plusieurs sections thématiques pour une analyse complète :

1.  **Coût du réseau** : Affiche la répartition entre l'OPEX (coûts de fonctionnement annuels) et le CAPEX (investissements initiaux pour les nouvelles infrastructures).
2.  **Émissions de construction CO₂** : Présente le bilan carbone associé à la construction et à l'exploitation des sources d'énergie choisies.
3.  **Analyse financière** : Compare la rentabilité des modules pour identifier les sources les plus économiques à long terme.
4.  **Flux de production (Diagramme de Sankey)** : Montre visuellement le transfert d'énergie depuis les sources de production jusqu'à la consommation finale. L'épaisseur des traits indique le volume d'énergie.
5.  **Production & Demande (Évolution temporelle)** : Affiche la courbe de production face à la courbe de demande sur toute l'année. Vous pouvez filtrer par heure, jour ou mois.
6.  **Répartition par source** : Un graphique circulaire montrant la part de chaque type d'énergie (Éolien, Hydro, Solaire, etc.) dans votre mix total.
7.  **Top 10 productives** : Liste les infrastructures individuelles qui ont généré le plus d'énergie durant la simulation.
8.  **Saisonnalité** : Analyse comment la production varie selon les saisons.


### B. Outils et Actions
*   **Barre de navigation latérale** : Cliquez sur les icônes à gauche pour descendre instantanément vers le graphique souhaité sans avoir à faire défiler toute la page.
*   **Boutons de filtres** : Sur certains graphiques, vous pouvez cocher/décocher des sources pour isoler des données spécifiques.
*   **Bouton Exporter** : Permet de télécharger l'ensemble des données brutes de la simulation au format CSV.
*   **Bouton Quiz** : Testez vos connaissances sur l'énergie au Québec !

---

## 4. Analyser une Infrastructure Individuelle

En plus de la simulation globale du réseau, vous pouvez examiner chaque installation de manière isolée pour mieux comprendre son fonctionnement et son impact.

### A. Consulter les Détails Techniques
Cliquez sur n'importe quelle icône d'infrastructure sur la carte pour ouvrir son panneau de détails. Ce panneau vous donne accès à :
*   Fiche technique : Toutes les informations relatives à l'infrastructure, telles que la puissance nominale, sont affichées.
*   **Équivalences concrètes** : Pour mieux visualiser l'énergie produite, l'application traduit les chiffres en données parlantes (ex: nombre de foyers alimentés, millions de téléphones rechargeables).

<p align="center">
  <img src="../docs/images/details.png" width="400" />
</p>

### B. Comprendre les Impacts et le Cycle de Vie
En cliquant sur le bouton "En apprendre plus sur...", vous accédez à une documentation pédagogique spécifique au type d'infrastructure sélectionné :
*   **Cycle de vie spécifique** : Les étapes clés de la vie d'une installation (conception, construction, exploitation, fin de vie) adaptées au type d'infrastructure choisi.
*   **Impacts environnementaux** : Un bilan sur les émissions de CO₂, mais aussi sur les effets environnementaux propres à chaque type d'infrastructure (impact sur la faune, la flore, les sols ou le paysage).

<p align="center">
  <img src="../docs/images/cycle_de_vie.png" width="700" />
</p>

### C. Simulation d'une Infrastructure Unique
Le bouton "Simuler cette infrastructure" ouvre une fenêtre dédiée aux performances de ce site spécifique :
*   **Bilan financier et carbone** : Consultez les coûts annuels (OPEX) et de construction (CAPEX), ainsi que l'empreinte carbone propre à cette installation.
*   **Graphique de production** : Visualisez comment la production de cette centrale évolue tout au long de l'année selon le scénario météo choisi.


<p align="center">
  <img src="../docs/images/sim_single.png" width="700" />
</p>

---

