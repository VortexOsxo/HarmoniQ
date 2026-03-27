# READ Calcul Eolien

Ce document explique en detail comment la puissance eolienne est calculee dans `calcule.py`, avec les entrees attendues, les traitements appliques, et les sorties produites.

## 1) Objectif du calcul

La fonction centrale est:

- `get_parc_power(parc, meteo)` dans `harmoniq/modules/eolienne/calcule.py`

Son role:

- prendre une serie meteo horaire (ou autre pas de temps),
- convertir cette meteo en puissance instantanee du parc (kW),
- renvoyer une serie de puissance par timestamp.

## 2) Entrees attendues

### 2.1 Entree `parc`

Objet de type `EolienneParc` (ou equivalent), avec au minimum:

- `modele_turbine`
- `hauteur_moyenne` (m)
- `puissance_nominal` (kW par turbine, dans ce code)
- `nombre_eoliennes`

### 2.2 Entree `meteo`

`DataFrame` indexe dans le temps, contenant:

- `temperature_C`
- `vitesse_vent_kmh`
- `direction_vent`

## 3) Chaine de calcul dans `calcule.py` (ordre reel)

## 3.1 Selection du modele turbine

Le code lit `turbine_data` via:

- `turbine_models.get(parc.modele_turbine)`

Si le modele est inconnu: `ValueError`.

## 3.2 Conversion temperature C -> K

Dans `get_parc_power`:

- `meteo["temperature"] = meteo["temperature_C"] + 273.15`

Cette temperature Kelvin sert au calcul des pertes de givre.

## 3.3 Conversion vent km/h -> m/s

Les courbes de puissance utilisent m/s, donc:

- `vitesse_vent_ms = meteo["vitesse_vent_kmh"] / 3.6`

## 3.4 Ajustement de la vitesse a la hauteur du moyeu

Fonction:

- `adjust_wind_speed(v_meteo, z_meteo, z_eolien, z0=0.03)`

Formule:

- `v_hub = v_ref * ln(z_hub / z0) / ln(z_ref / z0)`

Dans le code actuel:

- `z_ref = 100 m` (coherent avec les donnees vent 100 m utilisees)
- `z_hub = parc.hauteur_moyenne`
- `z0 = 0.03` (valeur fixe)

## 3.5 Courbe de puissance simplifiee (piecewise)

Fonction:

- `piecewise_power_curve(...)`

Logique:

- `P = 0` si `v < cut_in` ou `v > cut_out`
- croissance polynomiale entre `cut_in` et `rated`
- plateau a `rated_power` entre `rated` et `cut_out`

Notes importantes du code actuel:

- `rated_power` passe a la fonction = `parc.puissance_nominal` (kW)

### 3.5.b Nouvelle logique rated_speed / courbe de puissance

Le calcul applique maintenant une strategie en cascade:

1. Si `power_curve` existe pour la turbine:
   - interpolation de la courbe constructeur (`wind_speed`, `power`)
   - la puissance est convertie W -> kW puis appliquee directement
   - dans ce cas, `rated_speed` n est pas utilisee
2. Si `power_curve` est absente:
   - utiliser `rated_wind_speed` si presente dans `turbine_data.py`
3. Sinon (dernier fallback):
   - utiliser `12.0 m/s`, puis clipper dans `(cut_in + 0.5, cut_out - 0.5)`

Cette logique evite l ancienne approximation trop grossiere:

- ancien: `rated_speed = (cut_in + cut_out) / 2`
- probleme: quand `cut_out` est eleve (ex: 34 m/s), le midpoint donnait une valeur trop haute.

## 3.6 Pertes appliquees

### a) Pertes directionnelles

Fonction:

- `apply_directional_losses(direction_series)`

Mais dans le code actuel, ce facteur est calcule puis **non applique** (ligne commentee).

### b) Pertes de sillage (wake)

Fonction:

- `apply_wake_losses(direction_series)`

Regle:

- si `|direction - 180| < 30` => facteur `0.9`
- sinon => facteur `1.0`

### c) Pertes de givre

Fonction:

- `ice_loss_factor(temperature_k, stochastic=True)`

Regle:

- si `T < 263.15 K` (`< -10 C`): facteur `0.60`
- si `263.15 K <= T < 273.15 K` (`-10 C` a `0 C`): facteur `0.80`
- si `T >= 273.15 K` (`>= 0 C`): facteur `1.00`

Note:

- le parametre `stochastic` est conserve pour compatibilite, mais ignore.
- le resultat est desormais deterministe (pas de tirage aleatoire).

## 3.7 Passage de turbine -> parc

Puissance parc:

- `power_parc = power_with_ice_losses * parc.nombre_eoliennes`

## 3.8 Sortie de `get_parc_power`

DataFrame avec:

- `tempsdate`
- `vitesse_vent_kmh`
- `direction_vent`
- `puissance`

`puissance` est une puissance instantanee (kW), pas une energie.

## 4) Ce que fait chaque fonction du fichier

- `adjust_wind_speed`: ajuste le vent a la hauteur moyeu.
- `air_density`: calcule la densite d air mais n est pas utilisee dans `get_parc_power` actuellement.
- `piecewise_power_curve`: transforme vent (m/s) -> puissance turbine.
- `infer_rated_speed`: choisit `rated_speed` en fallback robuste.
- `power_from_real_curve`: interpole la courbe constructeur quand disponible.
- `apply_directional_losses`: calcule un facteur directionnel (actuellement non applique).
- `apply_wake_losses`: applique une perte simplifiee de sillage.
- `ice_loss_factor`: applique une perte simplifiee de givre.
- `get_parc_power`: orchestre tout le calcul.

## 5) Exemple concret: parc entre 4 points de maillage ERA5

Exemple fictif de la selection meteo (regle actuelle `floor_1p5`):

- points de grille autour du parc:
  - A: `(lat=48.0, lon=-67.5)` vent `22 km/h`
  - B: `(lat=48.0, lon=-66.0)` vent `30 km/h`
  - C: `(lat=49.5, lon=-67.5)` vent `18 km/h`
  - D: `(lat=49.5, lon=-66.0)` vent `26 km/h`
- parc au centre: `(lat=48.75, lon=-66.75)`
- selection actuelle:
  - `lat* = max(lat_i <= 48.75) = 48.0`
  - `lon* = max(lon_j <= -66.75) = -67.5`
- le calcul prend donc le point A, vent `22 km/h`.

Conclusion:

- pas d interpolation spatiale actuellement,
- un seul point meteo est utilise pour le parc.

## 6) Mini exemple chiffre de puissance (fictif)

Supposons un pas de temps:

- `vitesse_vent_kmh = 22`
- `direction_vent = 170`
- `temperature_C = -5`
- `hauteur_moyenne = 80 m`
- `puissance_nominal = 2000 kW`
- `nombre_eoliennes = 12`
- `cut_in = 3 m/s`, `cut_out = 25 m/s`, fallback `rated = 12 m/s`

Etapes:

1. `v_ref = 22/3.6 = 6.11 m/s`
2. facteur log (10m -> 80m, z0=0.03) ~ `1.358`
3. `v_hub ~ 8.30 m/s`
4. puissance turbine piecewise ~ `408 kW` (ordre de grandeur)
5. wake (direction 170 proche 180) => facteur `0.9` => `367 kW`
6. givre (T = -5 C, palier modere) facteur `0.80` => `294 kW` (arrondi)
7. parc (x12) => `~3528 kW`

## 7) Energie: ou est-elle calculee ?

`calcule.py` renvoie la puissance instantanee.

L integration en energie se fait plus tard dans:

- `harmoniq/modules/eolienne/__init__.py`

Formule:

- `E_MWh = sum(P_kW * dt_h) / 1000`

## 8) Limites actuelles a connaitre

- pas d interpolation spatiale meteo pour un parc entre mailles,
- fallback `rated_speed` simplifie pour les quelques modeles sans `power_curve`,
- pertes directionnelles calculees mais non appliquees,
- modele de givre simple par paliers (deterministe mais simplifie),
- `air_density` presente mais non utilisee dans la chaine actuelle.
