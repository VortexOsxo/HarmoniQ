"""Désagrégation horaire du dispatch hebdomadaire OPF.

Les réservoirs hydroélectriques absorbent toute la variabilité intra-hebdomadaire
de la demande. Les autres générateurs (éolien, solaire, nucléaire, fil-de-l'eau,
thermique, import) gardent leur valeur hebdomadaire constante sur toute la semaine.

Flux d'exécution :
    1. OPF hebdomadaire (53 snapshots, ~1s) → ``network.generators_t.p``
    2. ``disaggregate_to_hourly()`` → 8760 lignes horaires
    3. Les résultats horaires remplacent les snapshots dans ``network`` pour que
       ``extract_kpis()`` calcule les KPIs sur la résolution horaire réelle.

Formule par heure t dans la semaine w :
    δ(t) = demand_horaire(t) − demand_hebdo(w)
    P_réservoir_horaire[t] = clip(P_réservoir_hebdo[w] + δ(t) × poids, 0, p_max)
    résiduel(t) = Σδ non absorbé → import additionnel
"""

import logging
from typing import Dict, List

import numpy as np
import pandas as pd
import pypsa

logger = logging.getLogger("Disaggregator")

# Uplift T&D appliqué aussi à la demande horaire (cohérence avec data_loader.py)
_TD_UPLIFT = 1.07


def disaggregate_to_hourly(
    network: pypsa.Network,
    hourly_demand: pd.DataFrame,
    reservoir_gen_names: List[str],
) -> Dict[str, pd.DataFrame]:
    """Désagrège le dispatch hebdomadaire OPF vers une résolution horaire.

    Pour chaque heure, les générateurs non-réservoirs gardent la valeur hebdo
    fixe. Les réservoirs absorbent les écarts ±MW entre demande horaire et
    demande hebdo, dans la limite de leur capacité (p_nom × 0.95).

    Args:
        network: Réseau PyPSA post-OPF. ``generators_t.p`` doit être peuplé
            (dispatch hebdomadaire, 53 snapshots).
        hourly_demand: DataFrame 8760 × buses (MW, sans uplift T&D).
            Obtenu via ``load_demand_profile(resolution="horaire")``.
        reservoir_gen_names: Noms des générateurs ``hydro_reservoir``.

    Returns:
        Dict avec :
            ``dispatch_horaire``  — DataFrame 8760 × générateurs (MW)
            ``import_residuel``   — Series 8760 (MW d'import additionnel)
    """
    weekly_dispatch: pd.DataFrame = network.generators_t.p
    if weekly_dispatch.empty:
        logger.warning("disaggregate_to_hourly : generators_t.p vide — retour vide")
        return {
            "dispatch_horaire": pd.DataFrame(),
            "import_residuel": pd.Series(dtype=float),
        }

    weekly_demand_total: pd.Series = network.loads_t.p_set.sum(axis=1)
    hourly_demand_total: pd.Series = hourly_demand.sum(axis=1) * _TD_UPLIFT

    weekly_snaps = network.snapshots
    hourly_index = hourly_demand_total.index

    # Poids de distribution proportionnels à p_nom
    res_in_network = [r for r in reservoir_gen_names if r in network.generators.index]
    total_res_cap = sum(network.generators.loc[r, "p_nom"] for r in res_in_network)
    if total_res_cap <= 0:
        logger.warning("disaggregate_to_hourly : aucune capacité réservoir — δ non absorbé")
        total_res_cap = 1.0

    res_weights: Dict[str, float] = {
        r: network.generators.loc[r, "p_nom"] / total_res_cap
        for r in res_in_network
    }
    res_p_max: Dict[str, float] = {
        r: float(network.generators.loc[r, "p_nom"]) * 0.95
        for r in res_in_network
    }

    non_res_gens = [g for g in weekly_dispatch.columns if g not in reservoir_gen_names]

    result = pd.DataFrame(
        np.nan, index=hourly_index, columns=weekly_dispatch.columns, dtype=float
    )
    import_residuel = pd.Series(0.0, index=hourly_index)

    for i, w_snap in enumerate(weekly_snaps):
        w_next = (
            weekly_snaps[i + 1]
            if i + 1 < len(weekly_snaps)
            else w_snap + pd.Timedelta(weeks=1)
        )
        mask = (hourly_index >= w_snap) & (hourly_index < w_next)
        if not mask.any():
            continue

        w_demand = float(weekly_demand_total.get(w_snap, 0.0))
        delta: pd.Series = hourly_demand_total[mask] - w_demand  # ± MW

        # Non-réservoirs : constantes sur la semaine
        if non_res_gens:
            weekly_vals = weekly_dispatch.loc[w_snap, non_res_gens].values
            result.loc[mask, non_res_gens] = weekly_vals

        # Réservoirs : absorber delta proportionnellement
        residuel = delta.copy()
        for r, weight in res_weights.items():
            p_max = res_p_max[r]
            p_weekly = float(
                weekly_dispatch[r].get(w_snap, 0.0)
                if r in weekly_dispatch.columns else 0.0
            )
            correction = delta.values * weight
            p_horaire = np.clip(p_weekly + correction, 0.0, p_max)
            result.loc[mask, r] = p_horaire
            # Résidu = correction demandée − correction réellement absorbée
            residuel -= pd.Series(p_horaire - p_weekly, index=hourly_index[mask])

        # Import additionnel pour couvrir le résidu positif (pic non absorbé)
        import_residuel[mask] += residuel.clip(lower=0.0)

    result.fillna(0.0, inplace=True)

    logger.info(
        "Désagrégation horaire : %d snapshots → %d heures | "
        "%d réservoirs | import résiduel max %.0f MW",
        len(weekly_snaps),
        len(hourly_index),
        len(res_in_network),
        float(import_residuel.max()),
    )
    return {"dispatch_horaire": result, "import_residuel": import_residuel}
