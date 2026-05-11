# Dépendances module éolien + ERA5

## 1) Dépendances Python

### Noyau calcul éolien
- `numpy`
- `pandas`
- `scipy`
- `pandera`

### Météo (Open-Meteo + ERA5)
- `openmeteo-requests`
- `requests-cache`
- `retry-requests`
- `xarray`
- `cdsapi`
- `netCDF4`
- `pyarrow` (lecture/écriture Parquet du cache ERA5)

### Visualisation (cartes/plots éolien)
- `matplotlib`
- `geopandas`
- `shapely`

## 2) Installation rapide (commande unique)

Depuis la racine du projet:

```powershell
pip install numpy pandas scipy pandera openmeteo-requests requests-cache retry-requests xarray cdsapi netCDF4 pyarrow matplotlib geopandas shapely
```

## 3) Pré-requis CDS (Copernicus) pour ERA5

Créer le fichier `~/.cdsapirc` (Windows: `C:\Users\<ton_user>\.cdsapirc`) avec ton token CDS:

```yaml
url: https://cds.climate.copernicus.eu/api
key: <UID>:<API_TOKEN>
```

## 4) Télécharger / construire le cache ERA5

Depuis la racine du projet:

```powershell
python -m harmoniq.scripts.fetch_era5_quebec_2024 --year 2024
```

Option pour forcer un re-téléchargement:

```powershell
python -m harmoniq.scripts.fetch_era5_quebec_2024 --year 2024 --force-download
```

### Comportement vis-à-vis des données existantes

- `--year <ANNEE>` sans `--force-download`:
  - ne supprime pas les autres années déjà présentes;
  - ne remplace pas les fichiers mensuels de l'année ciblée s'ils existent déjà et sont valides (cache hit).

- `--year <ANNEE> --force-download`:
  - force le re-téléchargement de l'année ciblée;
  - remplace les fichiers mensuels bruts/caches de cette année;
  - ne touche pas aux autres années (ex: forcer 2023 ne supprime pas 2024).

## 5) Emplacements de données créées

- Brut NetCDF: `data/meteo/era5/raw/year=2024/month=MM/era5_qc_2024_MM.nc`
- Cache normalisé Parquet: `data/meteo/era5/cache/normalized/year=2024/month=MM/era5_normalized_2024_MM.parquet`

## 6) Où changer les critères d'appel API ERA5 (variables, année, zone, résolution)

Cette section indique **exactement** où modifier les paramètres d'extraction ERA5.

### 6.1 Année à télécharger

Option simple (sans modifier le code):

- Commande:
  - `python -m harmoniq.scripts.fetch_era5_quebec_2024 --year 2025`

Fichier concerné:

- `harmoniq/scripts/fetch_era5_quebec_2024.py`
  - argument CLI `--year` (valeur par défaut actuellement `2024`)

### 6.2 Variables ERA5 demandées à l'API

Fichier à modifier:

- `harmoniq/core/meteo_era5/downloader.py`
  - méthode `_build_month_request(...)`
  - clé `variable = [...]`

Variables actuellement demandées:

- `100m_u_component_of_wind`
- `100m_v_component_of_wind`
- `2m_temperature`

Si tu ajoutes une variable (ex: humidité, pression, etc.), il faut **aussi** mettre à jour:

- `harmoniq/core/meteo_era5/transform.py`
  - ajouter la détection de variable (pattern `*_CANDIDATES`)
  - convertir l'unité vers le format interne souhaité
  - ajouter la colonne dans la sortie normalisée
- `harmoniq/core/meteo_era5/validate.py`
  - ajouter les contrôles de présence/NaN pour la nouvelle colonne

Sinon, le pipeline peut télécharger la variable mais ne pas l'exposer dans le cache final.

### 6.3 Zone géographique (bbox)

Fichier à modifier:

- `harmoniq/core/meteo_era5/config.py`
  - `area_nwse: tuple[float, float, float, float]`

Format attendu:

- `(north, west, south, east)` en degrés
- exemple actuel Québec: `(62.0, -79.8, 44.5, -57.0)`

Cette zone est passée telle quelle à l'API ERA5 via `downloader.py` (`"area": ...`).

### 6.4 Résolution spatiale de la grille

Fichier à modifier:

- `harmoniq/core/meteo_era5/config.py`
  - `grid_deg: tuple[float, float]`

Exemple actuel:

- `(1.5, 1.5)` degré

Attention:

- une grille plus fine augmente fortement le volume de données et le temps de traitement;
- certaines parties du code utilisent le sélecteur `floor_1p5` (logique de sélection de cellule). Si tu changes la grille, vérifie la cohérence de ce sélecteur dans les modules qui consomment ERA5.

### 6.5 Jeu de données ERA5

Fichier à modifier:

- `harmoniq/core/meteo_era5/config.py`
  - `dataset = "reanalysis-era5-single-levels"`

Puis vérifier que les noms de variables du nouveau dataset sont bien couverts dans:

- `harmoniq/core/meteo_era5/transform.py` (`*_CANDIDATES`)

### 6.6 Mois / sous-période à télécharger

Fichier à modifier (si besoin avancé):

- `harmoniq/core/meteo_era5/downloader.py`
  - méthode `download_year(...)`
  - argument `months`

Par défaut, les 12 mois sont traités. Tu peux passer une liste de mois pour un test rapide.

### 6.7 Dossier de stockage brut/cache

Fichier à modifier:

- `harmoniq/core/meteo_era5/config.py`
  - `raw_dir`
  - `cache_dir`

Utilise cette option si tu veux isoler un nouveau jeu de tests sans écraser le cache existant.

### 6.8 Checklist rapide après modification

1. Lancer un téléchargement test:
   - `python -m harmoniq.scripts.fetch_era5_quebec_2024 --year 2024 --force-download`
2. Vérifier la génération des Parquet dans `data/meteo/era5/cache/normalized/...`
3. Tester l'API carte des vents:
   - `GET /api/meteo/wind-map/years`
   - `GET /api/meteo/wind-map/annual?year=2024`
4. Exécuter les tests ERA5/wind-map si disponibles.
