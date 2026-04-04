# reseau_bis - Gabarit complet de refonte (HarmoniQ)

Ce dossier est un **gabarit complet** pour reconstruire le module reseau,
avec des TODOs explicites et des contrats I/O stables.

## Entrées attendues

1. `Scenario`
   - `id`
   - `date_de_debut`
   - `date_de_fin`
   - `pas_de_temps`

2. `ListeInfrastructures`
   - `id`
   - `parc_eoliens`
   - `parc_solaires`
   - `central_hydroelectriques`
   - `central_thermique`
   - `central_nucleaire`

3. Donnees DB topologie
   - `bus`
   - `line`
   - `line_type`

4. Donnees modules de production
   - eolien, solaire, hydro, thermique, nucleaire
   - sorties converties en `p_max_pu` et `marginal_cost`

5. Donnee de demande
   - via `read_demande_data`
   - puis repartie sur les bus de consommation

## Sorties cibles

1. `metadata`
   - scenario_id, liste_infra_id, is_journalier, execution_time_seconds, timestamps

2. `production` (liste)
   - `timestamp`
   - `snapshot` (alias compat)
   - `totale`
   - `total_eolien`, `total_solaire`, `total_hydro_fil`, `total_hydro_reservoir`
   - `total_import`, `total_nucleaire`, `total_thermique`

3. `line_flows`
   - `line`, `max_flow_mw`, `s_nom_mva`, `loading_percent`

4. `summary`
   - `n_buses`, `n_lines`, `n_generators`, `total_energy_mwh`

## TODOs centralises

Voir:
- `IMPLEMENTATION_TODO.md`
- `service.get_reseau_bis_todo_list()`

## Prérequis

Avant de lancer une simulation, la base de données doit être initialisée :

```bash
init-db --populate        # premier setup
init-db --reset --populate  # si la DB existe déjà et qu'on veut repartir à zéro
```

Cette commande (définie dans `pyproject.toml` → `harmoniq.scripts.init_database:main`)
charge la topologie (bus, lignes, types de lignes) et les données d'infrastructure
(éoliennes, hydro, thermique, solaire) depuis les CSV dans `harmoniq/db/CSVs/`.

**Sans cette étape, la simulation retournera 0 pour tous les modes de production.**

## Rappel important

La logique import/export et le dispatch PyPSA complet sont actifs via DC-LOPF
(rolling horizon, 240h chunks). Les interconnexions sont modélisées comme des Links
PyPSA avec generators de marché aux bus Étranger.
