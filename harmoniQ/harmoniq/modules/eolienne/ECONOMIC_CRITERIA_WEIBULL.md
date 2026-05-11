# Critères économiques Weibull (v2)

Ce document décrit le classement multi-critères ajouté au module de sélection de turbine éolienne.

## 1) Résumé express (pour découvrir le projet)

Cette section résume ce qu'il faut retenir pour comprendre rapidement comment une turbine est classée.

### 1.1 Les critères économiques principaux

| Critère | Ce que ça mesure | Sens du classement |
|---|---|---|
| `annual_energy_park_mwh` | Production annuelle du parc standard | Plus grand = meilleur |
| `om_cost_per_mwh_cad` | Coût O&M annuel ramené au MWh | Plus petit = meilleur |
| `total_annual_cost_per_mwh_cad` | Coût total annualisé (CAPEX amorti + O&M) ramené au MWh | Plus petit = meilleur |

Point important:

- Le projet garde volontairement des classements séparés.
- Il n'y a pas de score unique pondéré en v2.
- Cela évite de cacher les compromis entre performance énergétique et performance économique.

### 1.2 Comment les classements sont établis

Les rangs sont calculés directement à partir des colonnes ci-dessus:

- `rank_energy`: tri décroissant sur `annual_energy_park_mwh`.
- `rank_om_cost`: tri croissant sur `om_cost_per_mwh_cad`.
- `rank_total_cost`: tri croissant sur `total_annual_cost_per_mwh_cad`.

Les deltas montrent les déplacements dans le classement:

- `rank_delta_total_vs_energy = rank_total_cost - rank_energy`
- `rank_delta_om_vs_energy = rank_om_cost - rank_energy`
- Delta négatif: la turbine est meilleure en coût qu'en énergie.
- Delta positif: la turbine perd des places quand on regarde le coût.

### 1.3 Exemple concret (lecture rapide)

Exemple fictif avec 2 turbines:

| Modèle | Énergie (MWh/an) | Coût total (C$/MWh) | Conclusion |
|---|---:|---:|---|
| Turbine A | 730000 | 74 | Très bonne en énergie, moins bonne en coût |
| Turbine B | 700000 | 68 | Un peu moins d'énergie, meilleure en coût |

Interprétation:

- Meilleure turbine "production" = Turbine A (`rank_energy = 1`).
- Meilleure turbine "économie" = Turbine B (`rank_total_cost = 1`).
- C'est exactement l'intérêt des classements séparés: décider selon l'objectif du projet.

### 1.4 Visuel mental du pipeline

```text
Vent (Weibull au point lat/lon)
        |
        v
Distribution des vitesses (0..25 m/s)
        |
        v
Énergie annuelle par modèle de turbine
        |
        v
CAPEX amorti + O&M (site + dépendance au nb de turbines)
        |
        v
Coûts par MWh
        |
        v
3 classements: énergie / O&M / coût total
```

Si vous débutez:

- Commencez par lire `rank_energy` et `rank_total_cost`.
- Regardez ensuite `rank_delta_total_vs_energy` pour voir les modèles qui gagnent ou perdent le plus quand on passe d'un objectif "énergie" à un objectif "économie".

## 2) Ce qui existait déjà

Les critères déjà produits par `turbine_selection.py`:

- `annual_energy_park_mwh`
  - Énergie annuelle attendue du parc standard (classement principal v1).
- `park_nominal_cost_per_mwh`
  - Coût nominal simple en `$ / MWh` avec:
    - `park_nominal_power_cost = park_mw * price_per_mw`
    - `park_nominal_cost_per_mwh = park_nominal_power_cost / annual_energy_park_mwh`

## 3) Nouveaux critères économiques (v2)

### 3.1 Hypothèses économiques retenues

Scénario par défaut: `economic_scenario = "cer_2026_current"`

Le but de ces hypothèses est de garder un modèle économique cohérent, traçable et comparable entre turbines, même sans données financières de projet réelles (financement, contrat EPC, O&M signé, taux d'actualisation, inflation locale, etc.).

- `capex_cad_per_kw = 1994`
  - Pourquoi: c'est la valeur onshore 2024 publiée par la CER (Energy Futures 2026, Appendix 2), déjà exprimée en C$2025/kW.
  - Comment: on applique une valeur unique à toutes les turbines pour éviter d'introduire un biais fournisseur tant qu'on n'a pas de CAPEX spécifique par modèle.
  - Impact: le CAPEX total du parc est identique pour toutes les turbines à puissance de parc fixée (`park_mw`), ce qui concentre les différences de coût/MWh sur la production et l'O&M.

- `project_life_years = 25`
  - Pourquoi: alignement avec la durée de vie de référence utilisée dans le cas onshore utility-scale EIA (Case 13).
  - Comment: amortissement linéaire simple (`capex_park_cad / 25`) en v2.
  - Impact: donne un coût annuel comparable entre modèles sans introduire (encore) de WACC/discounting.

- `fom_ratio = 33.06 / 1489`
  - Pourquoi: l'EIA donne FOM en `$ / kW-yr` (33.06) et CAPEX en `$ / kW` (1489) pour un cas de référence onshore.
  - Comment: on transforme ces deux valeurs en ratio sans unité (`FOM/CAPEX`) pour réutiliser la structure EIA avec un CAPEX CER (1994 C$/kW) et rester cohérent en ordre de grandeur.
  - Impact: la charge O&M fixe annuelle est proportionnelle à la taille économique du parc.

- `vom_cad_per_mwh = 0`
  - Pourquoi: l'EIA Case 13 utilise VOM = 0 pour ce cas onshore de référence.
  - Comment: aucun coût variable additionnel par MWh n'est ajouté en v2.
  - Impact: le coût variable n'influence pas le classement; seul l'effet énergie + composantes fixes O&M joue.

- `om_turbine_share = (2.24 + 2.80) / 6.6112`
- `om_site_share = 1 - om_turbine_share`
  - Pourquoi: on veut éviter un O&M 100% fixe qui ignorerait la complexité opérationnelle liée au nombre de turbines.
  - Comment: on reprend une décomposition de postes O&M pour séparer une part "liée aux turbines" (maintenance unités) et une part "liée au site" (infrastructures et exploitation plus globales).
  - Impact: à parc de 200 MW constant, une turbine de faible puissance unitaire (donc plus d'unités) pénalise davantage la composante O&M turbine.

- `n_ref_turbines = 200 / 2.8`
  - Pourquoi: il faut une base de normalisation pour que la composante O&M "turbine" varie de façon relative autour d'un parc de référence.
  - Comment: parc standard 200 MW divisé par une turbine de référence 2.8 MW.
  - Impact: l'ajustement O&M turbine est neutre au point de référence et évolue proportionnellement quand `equivalent_turbine_count` est plus haut ou plus bas.

- Monnaie: `C$2025`
  - Pourquoi: la source CER retenue pour le CAPEX est exprimée dans cette base monétaire.
  - Comment: on garde cette base partout pour éviter les incohérences de conversion monétaire/réelle vs nominale dans v2.
  - Impact: les résultats sont comparatifs en C$2025; une calibration future pourra ajouter inflation, taux de change et scénarios temporels.

Limites connues (acceptées en v2):

- Pas de coût de financement (WACC), pas de VAN/LCOE complet, pas de fiscalité.
- Pas de différenciation CAPEX par OEM/modèle de turbine.
- Pas de logistique régionale (transport, fondations, raccordement local, contraintes hivernales).

Ces hypothèses sont donc faites pour un classement économique relatif robuste (entre turbines), pas pour un budget d'investissement définitif.

### 3.2 Formules appliquées

Pour un parc standard de `park_mw`:

- `capex_park_cad = capex_cad_per_kw * park_kw`
- `annual_capex_amortized_cad = capex_park_cad / project_life_years`
- `annual_fom_total_cad = fom_ratio * capex_park_cad`
- `annual_om_site_cost_cad = annual_fom_total_cad * om_site_share`
- `annual_om_turbine_cost_cad = annual_fom_total_cad * om_turbine_share * (equivalent_turbine_count / n_ref_turbines)`
- `annual_variable_om_cost_cad = vom_cad_per_mwh * annual_energy_park_mwh`
- `annual_om_cost_cad = annual_om_site_cost_cad + annual_om_turbine_cost_cad + annual_variable_om_cost_cad`
- `annual_total_cost_cad = annual_capex_amortized_cad + annual_om_cost_cad`
- `om_cost_per_mwh_cad = annual_om_cost_cad / annual_energy_park_mwh`
- `total_annual_cost_per_mwh_cad = annual_total_cost_cad / annual_energy_park_mwh`

## 4) Classements séparés (sans score unique)

Les rangs v2 sont volontairement séparés:

- `rank_energy`: tri décroissant sur `annual_energy_park_mwh`
- `rank_om_cost`: tri croissant sur `om_cost_per_mwh_cad`
- `rank_total_cost`: tri croissant sur `total_annual_cost_per_mwh_cad`

Indicateurs de mouvement:

- `rank_delta_total_vs_energy = rank_total_cost - rank_energy`
- `rank_delta_om_vs_energy = rank_om_cost - rank_energy`

Convention:

- Valeur négative: le modèle monte dans le classement coût vs énergie.
- Valeur positive: le modèle descend dans le classement coût vs énergie.

## 5) Fichiers produits

Sorties principales:

- `turbine_ranking.csv` (rétrocompatible, enrichi)
- `turbine_ranking_multi_criteria.csv` (mêmes colonnes orientées v2)
- `economic_assumptions.json`
- `best_turbine_summary.json` (avec `best_by_energy` et `best_by_total_cost`)

## 6) Sources utilisées

- CER EF2026 Appendix 2 (onshore wind 2024 = 1,994 C$2025/kW):
  https://www.cer-rec.gc.ca/en/data-analysis/canada-energy-future/2026/appendix-2/
- EIA 2024 utility-scale capital/performance (Case 13 onshore: 1,489 $/kW, FOM 33.06 $/kW-yr, VOM 0, life 25 ans):
  https://www.eia.gov/analysis/studies/powerplants/capitalcost/pdf/capital_cost_AEO2025.pdf
- NREL ATB Financial Cases & Methods (référence méthodologique future):
  https://atb.nrel.gov/electricity/2024b/financial_cases_%26_methods

