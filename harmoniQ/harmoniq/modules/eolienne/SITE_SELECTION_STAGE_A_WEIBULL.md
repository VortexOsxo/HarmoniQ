# Site Selection Stage A (Weibull)

Ce document decrit la nouvelle feature de screening geographique "Stage A" du module eolien.

## 1) Objectif

Trouver les meilleurs emplacements eoliens potentiels au Quebec avec:

- un maillage geographique de 20 km,
- un mapping meteo ERA5 par cellule (partie entiere / floor),
- un calcul Weibull + ranking turbine deja existant,
- un Top 10 final classe par energie annuelle du parc standard.

Le Stage A est volontairement un screening "rapide et transparent" avant les filtres de constructibilite.

## 2) Hypotheses retenues

- Zone analysee: BBox ERA5 du projet (north, west, south, east):
  - `(62.0, -79.8, 44.5, -57.0)`
- Filtre de validite geographique des sites:
  - les points du maillage sont conserves uniquement s'ils tombent dans le polygone du Quebec
    (base MRC locale `base_mrc_database.shp`)
- Resolution du maillage de screening:
  - `20 km` (EPSG:32198 puis reprojection WGS84)
- Resolution meteo de reference:
  - grille ERA5 `1.5 deg` (~100 km)
- Mapping point -> cellule meteo:
  - `floor_1p5` (pas d'interpolation)
- Classement principal:
  - `annual_energy_park_mwh` decroissant
- Dedoublonnage:
  - un seul representant par cellule ERA5 (point 20 km le plus proche du centre cellule)
- Exclusions geospatiales:
  - pas de filtre offshore/protege/reseau/pente en Stage A,
  - mais contrainte minimale appliquee: le site doit etre dans les frontieres du Quebec.

## 3) Formule de mapping floor

Pour un point `(lat, lon)` du maillage 20 km:

- `lat_cell = floor(lat, valeurs_lat_era5)`
- `lon_cell = floor(lon_norm, valeurs_lon_era5_norm)`

avec:

- `lon_norm = ((lon + 180) % 360) - 180`
- `floor(target, valeurs)` = plus grande valeur ERA5 `<= target`

Ce mapping reproduit la logique deja utilisee dans `Era5Cache.get_point_series(..., selector="floor_1p5")`.

## 4) Commande d'execution

### A. Aide

```powershell
.\venv\Scripts\python.exe -m harmoniq.scripts.select_wind_sites_weibull_stage_a --help
```

### B. Lancement standard (2015-2024)

```powershell
.\venv\Scripts\python.exe -m harmoniq.scripts.select_wind_sites_weibull_stage_a --start-year 2015 --end-year 2024 --mesh-km 20 --top-n 10 --park-mw 200
```

### C. Dossier de sortie custom

```powershell
.\venv\Scripts\python.exe -m harmoniq.scripts.select_wind_sites_weibull_stage_a --output-dir harmoniq/modules/eolienne/plot/site_screening_stage_a_run1
```

## 5) Fichiers generes

Par defaut dans:

- `harmoniq/modules/eolienne/plot/site_screening_stage_a/`

Artefacts:

- `mesh_points_20km.csv`
  - tous les points du maillage + cellule ERA5 associee + distance au centre de cellule
- `era5_cell_screening.csv`
  - une ligne par cellule ERA5 evaluee (Weibull + meilleur modele + KPI energie/cout)
- `top10_sites_stage_a.csv`
  - Top 10 final (representants uniques par cellule)
- `site_screening_stage_a_summary.json`
  - resume du run + meilleur site
- `top10_sites_stage_a.png`
  - visuel 2 panneaux (carte + barres energie)

## 6) Lecture rapide des resultats

Colonnes importantes dans `top10_sites_stage_a.csv`:

- `top_rank`
- `latitude`, `longitude` (point representant 20 km)
- `era5_latitude`, `era5_longitude` (cellule meteo utilisee)
- `best_model_by_energy`
- `annual_energy_park_mwh`
- `total_annual_cost_per_mwh_cad`

Interpretation:

- rang 1 = meilleur potentiel energie dans Stage A,
- `best_model_by_energy` = turbine recommandee pour ce site selon le critere energie.

## 7) Limites (assumees et connues)

- Stage A ne fait pas encore de verification de faisabilite terrain.
- Plusieurs points 20 km tombent dans la meme cellule meteo ERA5; le dedoublonnage evite des faux doublons dans le Top 10.
- Pas d'interpolation meteo intra-cellule.
- Le filtre frontiere Quebec ne remplace pas les contraintes de developpement (environnement, raccordement, permis).
- Les contraintes de reseau, environnement et permis sont reportees a l'etape B.
