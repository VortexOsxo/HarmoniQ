**Guide du développeur**

HarmoniQ

# **1\. Vue d'ensemble**

HarmoniQ simule la production énergétique d'un réseau électrique québécois configuré par l'utilisateur. L'utilisateur place des infrastructures sur une carte, définit un scénario temporel, puis lance une simulation qui optimise le réseau et affiche les résultats.

L'application est divisée en deux processus indépendants qui communiquent via une API REST:

* **Backend** (Python / FastAPI) : gère la persistance, les calculs de production par type d'infrastructure et l'optimisation du réseau via PyPSA.

* **Frontend** (Angular) : gère la carte interactive, les formulaires et les graphiques de résultats.

# 

# **2\. Structure du dépôt**

HarmoniQ/  
├── harmoniQ/      \# Backend Python  
├── client/        \# Frontend Angular  
├── .github/       \# CI (GitHub Actions)  
└── CONTRIBUTING.md

## **Backend**

harmoniQ/  
├── harmoniq/  
│   ├── \_\_init\_\_.py          \# DB\_PATH, DEMANDE PATH  
│   ├── db/  
│   │   ├── engine.py        \# Moteur SQLAlchemy, SessionLocal  
│   │   ├── schemas.py       \# Tous les modèles ORM et Pydantic  
│   │   ├── CRUD.py          \# Opérations CRUD génériques  
│   │   ├── demande.py       \# Requêtes sur la Demande d’électricité et de gaz  
│   │   ├── db.sqlite        \# Infrastructures et scénarios de base  
│   │   └── demande.db       \# Demande d’électricité et de gaz (\~7.3 Go)  
│   ├── modules/  
│   │   ├── eolienne/        \# Calculs éoliens  
│   │   ├── hydro/           \# Calculs hydro  
│   │   ├── solaire/         \# Calculs solaires  
│   │   ├── thermique/       \# Calculs thermiques  
│   │   ├── nucleaire/       \# Calculs nucléaires  
│   │   └── reseau/          \# Simulation réseau (PyPSA)  
│   ├── core/  
│   │   ├── base.py          \# Classe abstraite Infrastructure  
│   │   ├── meteo.py         \# WeatherHelper, accès unifié aux données météo  
│   │   ├── meteo\_era5/      \# Service ERA5 pour les cartes de vent  
│   │   └── offshore.py      \# Détection des zones offshore  
│   ├── webserver/  
│   │   ├── \_\_init\_\_.py      \# Instance FastAPI \+ middleware SPA  
│   │   ├── REST.py          \# Toutes les routes API (/api/\*)  
│   │   └── limiter.py       \# Limiteur de débit du serveur  
│   └── scripts/             \# Commandes CLI (launch-app, init-db, load-db)  
└── tests/  
    ├── unit/                \# Tests unitaires par module  
    └── test\_app.py          \# Tests d'intégration API

## **Frontend**

client/src/app/  
├── pages/  
│   ├── map-page/            \# Carte Leaflet, point central de l'app  
│   └── simulation-page/     \# Résultats de simulation  
├── components/  
│   ├── commons/             \# Composants partagés  
│   ├── infrastructure/      \# Formulaires et listes d'infrastructures  
│   └── infra-detail-modal/  \# Détail d'une infrastructure  
├── services/  
│   ├── simulation-service.ts  
│   ├── scenarios-service.ts  
│   ├── infrastrutures-service.ts  
│   ├── wind-map-service.ts  
│   ├── map-service.ts  
│   └── graph-services/      \# Un service Plotly par type de graphique  
├── models/  
├── guards/  
└── interceptors/

# 

# **3\. Backend**

La documentation interactive de l'API est disponible sur http://localhost:5000/docs ou http://localhost:5000/redoc.

## 

## **Pile technologique**

Python 3.8+, FastAPI, Uvicorn, SQLAlchemy, SQLite, PyPSA, Pandas, NumPy, PVlib, pytest.

## 

## **Modules d'infrastructure**

Tous les types d'infrastructure héritent de la classe abstraite Infrastructure (core/base.py). L'interface imposée à chaque module est :

* charger\_scenario() : charge les paramètres du scénario actif

* calculer\_production() : retourne un DataFrame de production horaire

* calculer\_cout\_construction() : CAPEX estimé

* calculer\_cout\_exploitation() : OPEX annuel

* calculer\_co2\_construction() : émissions liées à la construction

* calculer\_co2\_exploitation() : émissions annuelles d'exploitation

Le décorateur @necessite\_scenario lève une exception explicite si une de ces méthodes est appelée sans scénario chargé.

Pour ajouter un nouveau type d'infrastructure : créer un module dans modules/, hériter de Infrastructure, implémenter les méthodes ci-dessus.

## 

## **Simulation réseau (PyPSA)**

Le module modules/reseau/ contient deux classes principales :

* NetworkBuilder : construit le réseau PyPSA à partir des infrastructures et des lignes en base.

* NetworkOptimizer : résout l'optimisation linéaire (minimisation des coûts sous contraintes de capacité) sur la période du scénario.

Les résultats sont mis en cache dans n\_cache/ pour éviter de relancer une optimisation identique.

## 

## **Données météorologiques**

WeatherHelper (core/meteo.py) est l'abstraction unique pour accéder aux données météo. Deux sources sont supportées :

* **ERA5** (défaut) : données historiques stockées localement en CSV après téléchargement.

* **Open-Meteo** : API publique utilisée en repli.

Les cartes de vent utilisent Era5WindMapService (core/meteo\_era5/), qui retourne des données géolocalisées pour la couche cartographique du frontend.

# 

# **4\. Frontend**

## **Pile technologique**

Angular 21 (standalone components), TypeScript 5.9, Plotly.js, Leaflet, Bootstrap 5, Vitest.

## 

## **Architecture Angular**

Le projet utilise les standalone components d'Angular 21\. Chaque composant déclare ses propres dépendances dans son décorateur @Component.

## 

## **Visualisations**

Chaque type de graphique a son propre service dans graph-services/. Ces services génèrent la configuration Plotly (data \+ layout) sans la rendre eux-mêmes, le composant Angular s'en charge. Graphiques disponibles : séries temporelles de production, CAPEX/OPEX, émissions CO2, Sankey des flux d'énergie.

# **5\. Base de données**

## **Tables principales**

La base db.sqlite contient :

* scenario : paramètres de simulation

* eoliennes\_parc, hydro, solaire, thermique, nucleaire : infrastructures

* bus, line, line\_type : réseau électrique

* quebec\_offshore\_mesh\_meta, quebec\_offshore\_mesh\_points — grille offshore pour les éoliennes en mer

La base demande.db (\~7.8 Go) contient les données de demande d’électricité et de gaz du Québec pour les années 2035 et 2050\. Elle est en lecture seule, interrogée via db/demande.py.

Les infrastructures, scénarios et groupes d’infrastructures créés par l’utilisateur sont stockés dans le localStorage.

## 

## **Patron de modélisation**

Chaque ressource suit quatre couches (exemple : parc éolien) :

* EolienneParc : classe SQLAlchemy, mappe la table.

* EolienneParcBase : Pydantic, champs et validations.

* EolienneParcCreate : hérite de Base, pour les requêtes POST/PUT.

* EolienneParcResponse : hérite de Base, pour les réponses API (inclut l'id).

Toutes les ressources suivent ce même patron dans db/schemas.py.

# **6\. Tests**

## **Backend**

pytest, dans harmoniQ/tests/.

* tests/unit/ : tests unitaires isolés. Utilisent unittest.mock pour remplacer les dépendances. Peuvent être lancés sans environnement complet.

* tests/ : tests d'intégration. Utilisent le TestClient FastAPI avec une base de test dédiée. Les tests marqués @pytest.mark.integration appellent des API externes et sont exclus des runs par défaut.

En mode test (HARMONIQ\_TESTING=True), , les tests d'intégration qui démarrent l'application FastAPI utilisent test\_db.sqlite au lieu de la base principale. Les tests unitaires n'accèdent pas à la base de données.

## **Frontend**

Vitest \+ @testing-library/angular. Configuration dans vitest.config.ts.

# **7\. Flux de données**

Ce flux illustre ce qui se passe de bout en bout lors d'une simulation.

1. **Création du scénario.** ScenariosService envoie POST /api/scenario/. Le backend valide avec Pydantic et persiste en base.

2. **Ajout des infrastructures.** L'utilisateur crée une infrastructure via un formulaire. Elle est sauvegardée localement dans le localStorage

3. **Lancement de la simulation.** La simulation déclenche quatre requêtes séquentielles vers des endpoints distincts : /reseau/cout pour les coûts, /reseau/emission pour les émissions CO₂, /demande/sankey pour les flux de demande, et /reseau/production pour la production. Chaque service de graphique fait sa propre requête et met en cache le résultat indépendamment.

4. **Calcul de production.** Chaque module d'infrastructure appelle charger\_scenario() puis calculer\_production() et retourne un DataFrame horaire.

5. **Optimisation réseau.** NetworkBuilder assemble les productions dans un réseau PyPSA. NetworkOptimizer résout l'optimisation. Les résultats sont mis en cache.

6. **Affichage.** Les services graph-services/ génèrent les configurations Plotly. La simulation-page affiche les graphiques.