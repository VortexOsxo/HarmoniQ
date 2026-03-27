"""Template de construction du reseau PyPSA aligne sur les variables HarmoniQ."""

import logging
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
import pypsa

_logger = logging.getLogger(__name__)

# Prix de marché des échanges transfrontaliers.
#
# IMPORT — prix DIFFÉRENCIÉ par région (CAD/MWh) :
#   Données réelles (Chaire en énergie HEC, export_data CSV oct-déc 2025) :
#     - Ontario (col3) : 86% négatif = QC importe massivement (nucléaire cheap)
#     - NY (col1)      : mixte, QC importe surtout en hiver
#     - NE (col2)      : 100% positif = QC exporte toujours (jamais d'import)
#     - NB (col4)      : ~100% positif = QC exporte toujours
#   Données IESO 10 ans (2016-2022) : QC importe ~2,200 GWh/an d'Ontario.
#   En décembre 2025 : Ontario=-726 GWh, NY=-134, NE=+621, NB=+1036 → net +796 GWh.
#
#   Régions par ID d'intertie :
#     Ontario : Etranger10-15 (Beauharnois-ON, Outaouais, Paugan, Chenaux, Kipawa, Rapide)
#     NY      : Etranger8 (Hertel), Etranger9 (Massena)
#     NE      : Etranger4 (Appalaches-Maine), Etranger5 (Stanstead), Etranger6 (Bedford),
#               Etranger7 (Nicolet)
#     NB      : Etranger2 (Eel River), Etranger3 (Madawaska)
#
# EXPORT — prix fixe (revenu net, CAD/MWh) :
#   12 $/MWh net après wheeling (5-8 $/MWh), pertes (3-5%), rabais off-peak.
#   Revenu moyen HQ à l'export ≈ 5.5 ¢/kWh (Rapport Annuel 2023) → ~12 $/MWh net.

# --- Prix import par RÉGION × MOIS (CAD/MWh) ---
#                                    Jan   Fév   Mar   Avr   Mai   Jun   Jul   Aoû   Sep   Oct   Nov   Déc
_IMPORT_PRICE_ONTARIO_MONTHLY  = [15.0, 15.0, 18.0, 20.0, 30.0, 30.0, 30.0, 30.0, 30.0, 20.0, 18.0, 15.0]
_IMPORT_PRICE_NY_MONTHLY       = [22.0, 22.0, 25.0, 25.0, 40.0, 45.0, 45.0, 45.0, 40.0, 30.0, 25.0, 22.0]
_IMPORT_PRICE_NE_MONTHLY       = [30.0, 30.0, 30.0, 30.0, 45.0, 50.0, 50.0, 50.0, 45.0, 35.0, 30.0, 30.0]
_IMPORT_PRICE_NB_MONTHLY       = [25.0, 25.0, 25.0, 25.0, 35.0, 35.0, 35.0, 35.0, 35.0, 28.0, 25.0, 25.0]

# Mapping Etranger ID → profil de prix import
_IMPORT_PRICE_BY_ETRANGER = {
    # NB
    2:  _IMPORT_PRICE_NB_MONTHLY,       # Eel River
    3:  _IMPORT_PRICE_NB_MONTHLY,       # Madawaska
    # NE
    4:  _IMPORT_PRICE_NE_MONTHLY,       # Appalaches-Maine
    5:  _IMPORT_PRICE_NE_MONTHLY,       # Stanstead-Derby
    6:  _IMPORT_PRICE_NE_MONTHLY,       # Bedford-Highgate
    7:  _IMPORT_PRICE_NE_MONTHLY,       # Nicolet-NE
    # NY
    8:  _IMPORT_PRICE_NY_MONTHLY,       # Hertel-NY
    9:  _IMPORT_PRICE_NY_MONTHLY,       # Beauharnois-Massena
    # Ontario
    10: _IMPORT_PRICE_ONTARIO_MONTHLY,  # Beauharnois-Ontario
    11: _IMPORT_PRICE_ONTARIO_MONTHLY,  # Outaouais
    12: _IMPORT_PRICE_ONTARIO_MONTHLY,  # Paugan-Chat Falls
    13: _IMPORT_PRICE_ONTARIO_MONTHLY,  # Chenaux-Bryson
    14: _IMPORT_PRICE_ONTARIO_MONTHLY,  # Kipawa-Holden
    15: _IMPORT_PRICE_ONTARIO_MONTHLY,  # Rapide des Iles-Dymond
}

_MARKET_PRICE_IMPORT_CAD_MWH = 30.0   # fallback annuel (utilisé si pas de snapshots)
_MARKET_PRICE_EXPORT_CAD_MWH = 12.0

# Fraction minimale obligatoire du débit disponible pour l'hydro fil de l'eau.
#
# Réalité opérationnelle HQ (source : arXiv 2405.20199 + Wikipedia + CER Canada) :
#   - HQ traite le fil de l'eau comme "non-dispatchable/predetermined" dans RALPH :
#     l'eau coule, l'opérateur turbine TOUT le débit disponible (p_min ≈ p_max).
#   - Les turbines Francis/Kaplan ont un P_min TECHNIQUE de ~30% (en dessous → arrêt).
#     Ce 30% est le seuil d'arrêt physique, PAS le point d'opération nominal.
#   - Un débit réservé écologique (10-30% du module) bypass la centrale sans être turbiné ;
#     il est déjà exclu du profil p_max_pu fourni par InfraHydro.calculer_production().
#   - En pratique : ~95% du débit turbinable est effectivement turbiné en continu.
#
# Valeur 0.25 = 25% must-run : laisse le LP décider du dispatch optimal tout en
# garantissant un minimum de production fatale (contrainte physique turbine Francis/Kaplan).
# Si résultats non réalistes : essayer 0 (traiter comme renouvelable non-pilotable).
# Exports HQ réels : 33-35 TWh/an (hors sécheresse) sur ~213 TWh de production totale.
_HYDRO_FIL_MIN_PU_FRACTION = 0.0

# Fichier des capacités d'interconnexion (optionnel — fallback si absent).
_INTERCO_XLSX = (
    Path(__file__).parent.parent.parent.parent
    / "Interconnexions - Données révisées.xlsx"
)
# Capacité par défaut si le fichier n'est pas trouvé ou un ID ne correspond pas.
_DEFAULT_INTERCO_CAP_MW = 500.0

TOPOLOGY_REQUIRED_KEYS = ["buses", "lines", "line_types"]

# Facteurs de disponibilité par défaut (p_max_pu) utilisés pour le auto-sizing.
# Remplacer par les valeurs réelles si disponibles.
_DEFAULT_P_MAX_PU: Dict[str, float] = {
    "eolien":           0.70,
    "hydro_fil":        0.50,   # CF moyen annuel fil de l'eau HQ (profil saisonnier dans data_loader)
                                # Hiver ~0.32, printemps ~0.70, été ~0.55 — moyenne ≈ 0.50
    "hydro_reservoir":  0.85,
    "solaire":          0.10,
    "thermique":        0.95,
    "nucleaire":        0.90,
}

# Capacité thermique d'UN SEUL circuit par type de ligne (MVA).
# Basée sur SIL + limites thermiques typiques HQ/IEEE.
# Utilisée par auto_scale_line_capacities() pour calculer num_parallel.
_SNOM_BASE_PER_TYPE: Dict[str, float] = {
    "735kV_line": 2000.0,
    "765kV_line": 2400.0,
    "450kV_line":  900.0,
    "345kV_line":  700.0,
    "320kV_line":  650.0,
    "315kV_line":  600.0,
    "230kV_line":  400.0,
    "120kV_line":  200.0,
    "69kV_line":   100.0,
}


def auto_scale_line_capacities(
    network: pypsa.Network,
    p_max_pu_by_carrier: Optional[Dict[str, float]] = None,
    margin: float = 1.05,
) -> List[Dict]:
    """Ajuste s_nom des lignes pour garantir la faisabilité de l'OPF.

    Pour chaque bus :
    - gen_cap  = Σ(p_nom × p_max_pu) des générateurs connectés
    - demand_peak = max(p_set) de la charge connectée
    - required = max(gen_cap, demand_peak) × margin

    Si required > capacité_totale_lignes_connectées :
    - Bus feuille (degree=1) : num_parallel = ⌈required / s_nom_base⌉,
      s_nom = s_nom_base × num_parallel.
    - Bus multi-connexion : scale-up proportionnel de toutes les lignes,
      arrondi au multiple de s_nom_base.

    Retourne la liste des modifications appliquées (pour affichage).
    """
    pu = p_max_pu_by_carrier or _DEFAULT_P_MAX_PU
    requirements = _compute_bus_requirements(network, pu)
    changes: List[Dict] = []
    processed_lines: set = set()

    for bus_name, req in requirements.items():
        required = req["required_mw"] * margin
        if required <= 0:
            continue

        mask = (network.lines["bus0"] == bus_name) | (network.lines["bus1"] == bus_name)
        connected = network.lines[mask]
        if connected.empty:
            continue

        degree = len(connected)
        total_cap = float(connected["s_nom"].sum())

        if total_cap >= required:
            continue  # déjà suffisant

        if degree == 1:
            line_name = connected.index[0]
            if line_name in processed_lines:
                continue
            line_type = str(connected.iloc[0].get("type") or "735kV_line")
            s_nom_base = _SNOM_BASE_PER_TYPE.get(line_type, 600.0)
            num_parallel = math.ceil(required / s_nom_base)
            new_s_nom = s_nom_base * num_parallel
            old_s_nom = float(network.lines.at[line_name, "s_nom"])
            network.lines.at[line_name, "s_nom"] = new_s_nom
            changes.append({
                "bus": bus_name, "line": line_name, "line_type": line_type,
                "old_s_nom": old_s_nom, "new_s_nom": new_s_nom,
                "num_parallel": num_parallel,
                "reason": f"feuille: {req['required_mw']:.0f} MW / {s_nom_base:.0f} MVA/circuit",
            })
            processed_lines.add(line_name)
        else:
            scale = required / total_cap
            for line_name, line_row in connected.iterrows():
                if line_name in processed_lines:
                    continue
                old_s_nom = float(network.lines.at[line_name, "s_nom"])
                line_type = str(line_row.get("type") or "735kV_line")
                s_nom_base = _SNOM_BASE_PER_TYPE.get(line_type, old_s_nom or 600.0)
                num_parallel = max(1, math.ceil(old_s_nom * scale / s_nom_base))
                new_s_nom = s_nom_base * num_parallel
                network.lines.at[line_name, "s_nom"] = new_s_nom
                changes.append({
                    "bus": bus_name, "line": line_name, "line_type": line_type,
                    "old_s_nom": old_s_nom, "new_s_nom": new_s_nom,
                    "num_parallel": num_parallel,
                    "reason": f"multi (deg={degree}): {req['required_mw']:.0f}/{total_cap:.0f} MVA",
                })
                processed_lines.add(line_name)

    if changes:
        _logger.info(
            "auto_scale_line_capacities: %d lignes ajustées (margin=%.0f%%)",
            len(changes), (margin - 1) * 100,
        )
    return changes


def get_bus_capacity_report(
    network: pypsa.Network,
    p_max_pu_by_carrier: Optional[Dict[str, float]] = None,
) -> List[Dict]:
    """Retourne la configuration de capacité par bus.

    Chaque entrée contient :
      bus, degree, line_type, num_parallel_est,
      gen_cap_mw, demand_peak_mw, line_cap_mva, utilization_pct, is_bottleneck
    Trié par utilisation décroissante.
    """
    pu = p_max_pu_by_carrier or _DEFAULT_P_MAX_PU
    requirements = _compute_bus_requirements(network, pu)
    report: List[Dict] = []

    for bus_name, req in requirements.items():
        mask = (network.lines["bus0"] == bus_name) | (network.lines["bus1"] == bus_name)
        connected = network.lines[mask]
        degree = len(connected)
        line_cap = float(connected["s_nom"].sum()) if not connected.empty else 0.0

        # Type dominant
        line_type = "—"
        if not connected.empty and "type" in connected.columns:
            counts = connected["type"].value_counts()
            if not counts.empty:
                line_type = str(counts.index[0])

        # Estimation num_parallel via s_nom max / s_nom_base
        s_nom_base = _SNOM_BASE_PER_TYPE.get(line_type, 0.0)
        max_s_nom = float(connected["s_nom"].max()) if not connected.empty else 0.0
        num_par = round(max_s_nom / s_nom_base, 1) if s_nom_base > 0 else 0.0

        net_needed = req["required_mw"]
        util_pct = (net_needed / line_cap * 100.0) if line_cap > 0 else 0.0

        report.append({
            "bus":             bus_name,
            "degree":          degree,
            "line_type":       line_type,
            "num_parallel":    num_par,
            "gen_cap_mw":      round(req["gen_cap"], 1),
            "demand_peak_mw":  round(req["demand_peak"], 1),
            "line_cap_mva":    round(line_cap, 1),
            "utilization_pct": round(util_pct, 1),
            "is_bottleneck":   net_needed > line_cap * 1.02 and line_cap > 0,
        })

    report.sort(key=lambda r: r["utilization_pct"], reverse=True)
    return report


def _compute_bus_requirements(
    network: pypsa.Network,
    p_max_pu_by_carrier: Dict[str, float],
) -> Dict[str, Dict]:
    """Calcule gen_cap / demand_peak / required_mw par bus."""
    result: Dict[str, Dict] = {}
    for bus_name in network.buses.index:
        gens = network.generators[network.generators["bus"] == bus_name]
        gen_cap = sum(
            float(row.get("p_nom", 0)) * p_max_pu_by_carrier.get(row.get("carrier", ""), 1.0)
            for _, row in gens.iterrows()
        )

        loads = network.loads[network.loads["bus"] == bus_name]
        demand_peak = 0.0
        for load_name in loads.index:
            if (hasattr(network, "loads_t")
                    and hasattr(network.loads_t, "p_set")
                    and load_name in network.loads_t.p_set.columns):
                demand_peak += float(network.loads_t.p_set[load_name].max())
            else:
                demand_peak += float(loads.loc[load_name, "p_set"])

        result[bus_name] = {
            "gen_cap":    gen_cap,
            "demand_peak": demand_peak,
            "required_mw": max(gen_cap, demand_peak),
        }
    return result


def get_builder_todo_list() -> List[str]:
    """Liste actionnable des elements a implementer dans le builder."""
    return [
        "Valider les colonnes minimales des DataFrames d'entree (bus/lines/generators).",
        "[DONE] Ne creer des loads que sur les bus de type consommation (pas tous les bus).",
        "[DONE] Ajouter la logique explicite d'import/export via Links PyPSA bidirectionnels.",
        "Ajouter les contraintes globales (si utilisees par PyPSA/linopy).",
        "Aligner toutes les series temporelles sur `network.snapshots`.",
    ]


def build_pypsa_network(
    topology: Dict[str, Any],
    generation_profiles: Dict[str, Any],
    demand_profile: pd.DataFrame,
    snapshots: pd.DatetimeIndex,
) -> pypsa.Network:
    """Construit un reseau PyPSA en conservant la semantique legacy.

    Mapping des entrees:
    - topology[buses, lines, line_types]
    - generation_profiles[generators, p_max_pu, marginal_cost]
    - demand_profile -> loads_t.p_set
    """
    _validate_topology_payload(topology)

    network = pypsa.Network()
    network.set_snapshots(snapshots)
    # PyPSA devrait inférer les weightings depuis le DatetimeIndex,
    # mais l'inférence échoue selon la version si freq n'est pas préservé.
    # On force explicitement la durée réelle du pas de temps (1h horaire, 168h hebdo).
    if len(snapshots) > 1 and hasattr(network, "snapshot_weightings"):
        _delta_h = (snapshots[1] - snapshots[0]).total_seconds() / 3600.0
        current_w = float(network.snapshot_weightings["generators"].iloc[0])
        if abs(current_w - _delta_h) > 0.5:
            network.snapshot_weightings.loc[:, :] = _delta_h

    # Déclarer les carriers pour éviter les warnings PyPSA 1.0+ et
    # permettre la reconstitution de la production par carrier dans results.py.
    _add_carriers(network)

    _add_buses(network, topology.get("buses"))
    _add_line_types(network, topology.get("line_types"))
    _add_lines(network, topology.get("lines"))

    # Stocker la capacité par circuit (données fichier = capacité réelle actuelle).
    # s_nom_per_circuit = s_nom_total / nb_circuits (num_parallel depuis le fichier).
    if not network.lines.empty and "num_parallel" in network.lines.columns:
        network.lines["s_nom_per_circuit"] = (
            network.lines["s_nom"] / network.lines["num_parallel"].clip(lower=1.0)
        ).round(1)
        # Garder la capacité originale (avant scaling) pour le rapport d'infrastructure.
        network.lines["s_nom_original"] = network.lines["s_nom"].copy()

    _add_generators(network, generation_profiles.get("generators"))
    _add_loads_on_conso_buses(network, topology.get("buses"))
    _add_interconnection_links(network, topology.get("buses"), topology.get("lines"))

    # Supprimer les bus isolés (aucune ligne ni link connecté) AVANT d'attacher les
    # séries temporelles.  Si on le fait après, generators_t.p_max_pu conserve les
    # colonnes des générateurs supprimés → PyPSA lève une erreur lors de la formulation
    # du LP ("Component not found").
    # Cas typique : Eolienne73 dont la seule ligne a été retirée par le collègue.
    _remove_isolated_buses(network)

    # Rattacher les series temporelles si elles sont fournies.
    # Le filtre sur network.generators.index est fait APRÈS le retrait des bus isolés
    # pour ne pas attacher de profils à des générateurs qui n'existent plus.
    p_max_pu = generation_profiles.get("p_max_pu")
    if isinstance(p_max_pu, pd.DataFrame) and not p_max_pu.empty:
        network.generators_t.p_max_pu = p_max_pu.reindex(index=network.snapshots, columns=[
            c for c in p_max_pu.columns if c in network.generators.index
        ]).fillna(0.0)

    # -----------------------------------------------------------------------
    # Hydro fil de l'eau = énergie fatale (comme éolien/solaire)
    # -----------------------------------------------------------------------
    # L'eau s'écoule indépendamment de la demande ; l'opérateur turbine ou déverse
    # (spillage coûteux et parfois interdit par la loi sur les eaux).
    # On force p_min_pu = _HYDRO_FIL_MIN_PU_FRACTION × p_max_pu :
    #   - Le LP DOIT turbiner au moins cette fraction du débit disponible.
    #   - Le surplus est évacué via les Links d'interconnexion (export @ _MARKET_PRICE).
    #   - La marge (1 − fraction) absorbe la maintenance et les petits débordements.
    # Valeur initiale = 0.85 ; à affiner avec les débits réservés légaux (IREQ/MELCC).
    hydro_fil_gens = [
        g for g in network.generators.index
        if network.generators.at[g, "carrier"] == "hydro_fil"
    ]
    if hydro_fil_gens and isinstance(p_max_pu, pd.DataFrame) and not p_max_pu.empty:
        fil_cols = [c for c in hydro_fil_gens if c in p_max_pu.columns]
        if fil_cols:
            fil_p_min = (
                p_max_pu
                .reindex(index=network.snapshots, columns=fil_cols)
                .fillna(0.0)
                * _HYDRO_FIL_MIN_PU_FRACTION
            )
            network.generators_t.p_min_pu = fil_p_min
            _logger.info(
                "Hydro fil de l'eau — p_min_pu = %.0f%% × p_max_pu sur %d générateurs "
                "(énergie fatale ; surplus → export @ %.1f $/MWh net).",
                _HYDRO_FIL_MIN_PU_FRACTION * 100, len(fil_cols), _MARKET_PRICE_EXPORT_CAD_MWH,
            )
        else:
            _logger.warning(
                "Hydro fil de l'eau : %d générateurs détectés mais aucun profil p_max_pu "
                "disponible — p_min_pu reste à 0 (pas d'énergie fatale modélisée).",
                len(hydro_fil_gens),
            )

    _logger.info(
        "Dispatch par mérite : éolien/solaire prioritaires (0.1 $/MWh) ; "
        "hydro_fil must-run %.0f%% (énergie fatale) ; hydro_reservoir flexible.",
        _HYDRO_FIL_MIN_PU_FRACTION * 100,
    )

    marginal_cost = generation_profiles.get("marginal_cost")
    if isinstance(marginal_cost, pd.DataFrame):
        network.generators_t.marginal_cost = marginal_cost.reindex(
            index=network.snapshots,
            columns=[c for c in marginal_cost.columns if c in network.generators.index],
        ).fillna(0.0)

    # --- Prix d'import saisonnier DIFFÉRENCIÉ PAR RÉGION ---
    # Données réelles (Chaire HEC, IESO 2016-2025) montrent que :
    #   - Ontario : QC importe massivement (surplus nucléaire, 86% du temps)
    #   - NE/NB  : QC exporte toujours (prix élevé → import jamais compétitif)
    #   - NY     : mixte (import hivernal, export estival)
    # On applique des prix d'import spécifiques à chaque région pour reproduire
    # ce pattern de flux simultanés (import Ontario + export NE/NB en décembre).
    import_gens = [
        g for g in network.generators.index
        if network.generators.at[g, "carrier"] == "import"
    ]
    if import_gens and len(network.snapshots) > 0:
        for g in import_gens:
            # Extraire l'ID Etranger depuis le nom du générateur (market_Etranger7_import → 7)
            m_id = re.search(r"Etranger(\d+)", g)
            etranger_id = int(m_id.group(1)) if m_id else -1
            price_profile = _IMPORT_PRICE_BY_ETRANGER.get(etranger_id)
            if price_profile is not None:
                prices = pd.Series(
                    [price_profile[ts.month - 1] for ts in network.snapshots],
                    index=network.snapshots,
                )
            else:
                # Fallback : prix moyen (pas de région identifiée)
                prices = pd.Series(_MARKET_PRICE_IMPORT_CAD_MWH, index=network.snapshots)
            if hasattr(network.generators_t, "marginal_cost") and not network.generators_t.marginal_cost.empty:
                network.generators_t.marginal_cost[g] = prices
            else:
                network.generators_t.marginal_cost = pd.DataFrame(
                    {g: prices}, index=network.snapshots,
                )
        _logger.info(
            "Prix import régional : %d générateurs — Ontario hiver=%.0f, NY=%.0f, NE=%.0f, NB=%.0f $/MWh",
            len(import_gens),
            _IMPORT_PRICE_ONTARIO_MONTHLY[0], _IMPORT_PRICE_NY_MONTHLY[0],
            _IMPORT_PRICE_NE_MONTHLY[0], _IMPORT_PRICE_NB_MONTHLY[0],
        )

    if isinstance(demand_profile, pd.DataFrame):
        # Filtrer aux loads existants (après _remove_isolated_buses certains bus Conso
        # peuvent avoir été retirés). Sans ce filtre, les colonnes orphelines ont le même
        # nom que des Bus → linopy confond les dimensions 'Load' et 'Bus' → erreur xarray.
        network.loads_t.p_set = demand_profile.reindex(
            index=network.snapshots,
            columns=[c for c in demand_profile.columns if c in network.loads.index],
        ).fillna(0.0)

    # Diagnostic de connectivité : détecter les composantes déconnectées qui ont
    # de la demande mais aucun générateur / link.  De telles composantes rendent
    # le LP infaisable (bilan nodal impossible même avec s_nom relâché).
    _log_disconnected_components(network)

    # Mise à l'échelle des lignes sous-dimensionnées pour garantir la faisabilité OPF.
    # Calcule ceil(requis / s_nom_par_circuit) par bus et ajuste s_nom en conséquence.
    # Les changements sont stockés sur le réseau → rapport d'infrastructure.
    scaling_changes = auto_scale_line_capacities(network)
    network._infra_scaling_changes = scaling_changes  # transmis à extract_kpis via le réseau

    return network


def _remove_isolated_buses(network: pypsa.Network) -> List[str]:
    """Retire les bus sans ligne ni link connecté pour éviter les infaisabilités LP.

    Un bus isolé avec un générateur (p_min_pu=0) crée un bilan nodal dégenéré
    dans la formulation kirchhoff de PyPSA : le générateur doit dispatché 0 car
    il n'a aucun chemin vers une charge, mais PyPSA peut ne pas gérer ce cas
    proprement et rendre l'ensemble du LP infaisable.

    Exemples de cas : Eolienne73 après suppression de sa seule ligne de connexion.
    """
    buses_with_lines: set = set()
    if not network.lines.empty:
        buses_with_lines = set(network.lines["bus0"]) | set(network.lines["bus1"])

    buses_with_links: set = set()
    if not network.links.empty:
        buses_with_links = set(network.links["bus0"]) | set(network.links["bus1"])

    connected_buses = buses_with_lines | buses_with_links
    removed: List[str] = []

    for bus_name in list(network.buses.index):
        if bus_name in connected_buses:
            continue

        # Bus vraiment isolé : retirer ses générateurs et charges d'abord
        gens_on_bus = network.generators[network.generators["bus"] == bus_name].index.tolist()
        loads_on_bus = network.loads[network.loads["bus"] == bus_name].index.tolist()

        if gens_on_bus or loads_on_bus:
            _logger.warning(
                "Bus isolé '%s' retiré du réseau (%d générateurs, %d charges) — "
                "aucune ligne/link connecté, ce bus briserait le LP-OPF.",
                bus_name, len(gens_on_bus), len(loads_on_bus),
            )
        for gen_name in gens_on_bus:
            network.remove("Generator", gen_name)
        for load_name in loads_on_bus:
            network.remove("Load", load_name)
        network.remove("Bus", bus_name)
        removed.append(bus_name)

    if removed:
        _logger.info("Bus isolés retirés (%d) : %s", len(removed), removed)

    return removed


def _log_disconnected_components(network: pypsa.Network) -> None:
    """Détecte et loggue les composantes connexes du réseau (lignes AC seulement).

    Une composante avec de la demande mais aucun générateur NI link d'import
    rend le LP-OPF infaisable même avec s_nom relâché.
    """
    if network.lines.empty:
        return

    # Construire le graphe d'adjacence (lignes AC uniquement, sans Etranger)
    adj: Dict[str, set] = {b: set() for b in network.buses.index}
    for _, line in network.lines.iterrows():
        b0, b1 = str(line["bus0"]), str(line["bus1"])
        if b0 in adj and b1 in adj:
            adj[b0].add(b1)
            adj[b1].add(b0)

    # BFS pour trouver les composantes connexes
    visited: set = set()
    components: List[set] = []

    for start in network.buses.index:
        if start in visited:
            continue
        comp: set = set()
        queue = [start]
        while queue:
            node = queue.pop()
            if node in visited:
                continue
            visited.add(node)
            comp.add(node)
            queue.extend(adj.get(node, set()) - visited)
        components.append(comp)

    if len(components) <= 1:
        return  # réseau connexe

    # Analyser chaque composante
    link_buses: set = set()
    if not network.links.empty:
        for col in ["bus0", "bus1"]:
            if col in network.links.columns:
                link_buses.update(network.links[col].dropna())

    for i, comp in enumerate(sorted(components, key=len, reverse=True)):
        gen_in_comp = network.generators[network.generators["bus"].isin(comp)]
        load_in_comp = network.loads[network.loads["bus"].isin(comp)]
        links_in_comp = [b for b in comp if b in link_buses]

        gen_cap = float(gen_in_comp["p_nom"].sum())
        n_loads = len(load_in_comp)
        has_supply = gen_cap > 0 or bool(links_in_comp)

        if not has_supply and n_loads > 0:
            _logger.error(
                "⚠ COMPOSANTE DÉCONNECTÉE #%d (%d bus) : %.0f MW gen, %d charges, "
                "0 link d'import → LP INFAISABLE. Buses: %s",
                i + 1, len(comp), gen_cap, n_loads,
                sorted(comp)[:10],
            )
        elif len(comp) < len(network.buses) * 0.9:  # composante mineure
            bus_label = next(iter(comp)) if len(comp) == 1 else f"{len(comp)} bus"
            gens_detail = (
                ", ".join(f"{g}({network.generators.at[g,'p_nom']:.0f}MW)"
                          for g in gen_in_comp.index[:3])
                if not gen_in_comp.empty else "—"
            )
            _logger.info(
                "Composante connexe #%d : [%s] %.0f MW gen, %d charges, "
                "%d links. Gén: %s",
                i + 1, bus_label, gen_cap, n_loads, len(links_in_comp),
                gens_detail,
            )


def _add_carriers(network: pypsa.Network) -> None:
    """Enregistre les carriers HarmoniQ dans le réseau (requis PyPSA 1.0+)."""
    carriers = {
        "eolien":           {"color": "#72B5E4", "nice_name": "Éolien"},
        "solaire":          {"color": "#F9D057", "nice_name": "Solaire"},
        "hydro_fil":        {"color": "#4287f5", "nice_name": "Hydro fil de l'eau"},
        "hydro_reservoir":  {"color": "#1b3a7d", "nice_name": "Hydro réservoir"},
        "thermique":        {"color": "#E05C17", "nice_name": "Thermique"},
        "nucleaire":        {"color": "#9B59B6", "nice_name": "Nucléaire"},
        "import":           {"color": "#95A5A6", "nice_name": "Import"},
        "export":           {"color": "#2ECC71", "nice_name": "Export"},
        "AC":               {"color": "#555555", "nice_name": "AC"},
    }
    for name, attrs in carriers.items():
        if name not in network.carriers.index:
            network.add("Carrier", name=name, **attrs)


def _validate_topology_payload(topology: Dict[str, Any]) -> None:
    missing = [k for k in TOPOLOGY_REQUIRED_KEYS if k not in topology]
    if missing:
        raise ValueError(f"Payload de topologie incomplet, cles manquantes: {missing}")


def _add_buses(network: pypsa.Network, buses_df: Any) -> None:
    if not isinstance(buses_df, pd.DataFrame) or buses_df.empty:
        return

    for _, row in buses_df.iterrows():
        name = row.get("name")
        if not name:
            continue
        kwargs = {k: row[k] for k in ["v_nom", "type", "x", "y", "control"] if k in buses_df.columns}
        network.add("Bus", name=name, **kwargs)


def _add_line_types(network: pypsa.Network, line_types_df: Any) -> None:
    if not isinstance(line_types_df, pd.DataFrame) or line_types_df.empty:
        return

    for _, row in line_types_df.iterrows():
        name = row.get("name")
        if not name:
            continue
        kwargs = {k: row[k] for k in ["f_nom", "r_per_length", "x_per_length", "b_per_length"] if k in line_types_df.columns}
        network.add("LineType", name=name, **kwargs)


def _add_lines(network: pypsa.Network, lines_df: Any) -> None:
    if not isinstance(lines_df, pd.DataFrame) or lines_df.empty:
        return

    skipped_orphan = 0
    for _, row in lines_df.iterrows():
        name = row.get("name")
        bus0 = str(row.get("bus0") or "")
        bus1 = str(row.get("bus1") or "")
        if not name or not bus0 or not bus1:
            continue
        # Les segments Interco→Etranger sont gérés comme Links PyPSA dans
        # _add_interconnection_links() — on les saute ici pour éviter le doublon.
        if bus0.startswith("Etranger") or bus1.startswith("Etranger"):
            continue
        # Vérifier que les deux extrémités existent dans le réseau.
        # Des lignes orphelines (bus supprimé du xlsx) déconnecteraient silencieusement
        # des sous-réseaux et rendraient le LP infaisable.
        if bus0 not in network.buses.index:
            _logger.warning("Ligne '%s' ignorée — bus0='%s' absent du réseau.", name, bus0)
            skipped_orphan += 1
            continue
        if bus1 not in network.buses.index:
            _logger.warning("Ligne '%s' ignorée — bus1='%s' absent du réseau.", name, bus1)
            skipped_orphan += 1
            continue
        kwargs = {k: row[k] for k in ["type", "length", "capital_cost", "num_parallel"] if k in lines_df.columns}
        # s_nom dans le fichier = capacité TOTALE (déjà tous circuits confondus).
        # num_parallel sert à PyPSA pour scaler l'impédance (x/r divisés par n),
        # mais PAS pour la limite thermique LP — on ne multiplie donc pas s_nom.
        kwargs["s_nom"] = float(row.get("s_nom") or 0)
        network.add("Line", name=name, bus0=bus0, bus1=bus1, **kwargs)

    if skipped_orphan:
        _logger.warning("%d lignes orphelines ignorées (bus inconnu)", skipped_orphan)


def _add_generators(network: pypsa.Network, generators_df: Any) -> None:
    if not isinstance(generators_df, pd.DataFrame) or generators_df.empty:
        return

    skipped = 0
    for _, row in generators_df.iterrows():
        name = str(row.get("name") or "")
        bus  = str(row.get("bus")  or "")
        if not name or not bus:
            continue
        if bus not in network.buses.index:
            _logger.warning(
                "Générateur '%s' ignoré — bus '%s' absent du réseau (bus non déclaré dans xlsx).",
                name, bus,
            )
            skipped += 1
            continue

        kwargs = {
            k: row[k]
            for k in ["carrier", "p_nom", "p_nom_extendable", "p_nom_min", "p_nom_max", "marginal_cost"]
            if k in generators_df.columns
        }
        network.add("Generator", name=name, bus=bus, **kwargs)

    if skipped:
        _logger.warning("%d générateurs ignorés (bus invalide)", skipped)


def _add_loads_on_conso_buses(network: pypsa.Network, buses_df: Any) -> None:
    """Cree une Load uniquement sur les bus de type 'conso'.

    Remplace _add_default_loads_if_missing qui creait une load sur TOUS les bus.
    Les bus 'line' (transit) et 'prod' n'ont pas de charge directe.
    """
    if not isinstance(buses_df, pd.DataFrame) or buses_df.empty:
        return
    if len(network.buses) == 0:
        return

    existing_load_buses = set(network.loads.bus) if len(network.loads) > 0 else set()
    for _, row in buses_df.iterrows():
        bus_name = row.get("name")
        bus_type = str(row.get("type", "")).lower()
        if bus_name and bus_name in network.buses.index and bus_name not in existing_load_buses:
            if bus_type == "conso":
                # Nom = identifiant du bus (Conso1, Conso2, ...) pour que
                # loads_t.p_set s'aligne directement avec les colonnes de demand_profile.
                network.add("Load", name=bus_name, bus=bus_name, p_set=0.0)


def _load_interco_capacities() -> Dict[int, Dict[str, float]]:
    """Charge les capacités import/export depuis le xlsx des interconnexions.

    Retourne {id: {"import_mw": X, "export_mw": Y}} pour chaque interconnexion.
    ID correspond au numéro dans le nom du bus (Interco3 → ID 3).
    Retourne {} si le fichier est absent ou illisible.
    """
    if not _INTERCO_XLSX.exists():
        _logger.warning("Fichier interconnexions introuvable : %s", _INTERCO_XLSX)
        return {}
    try:
        df = pd.read_excel(_INTERCO_XLSX)
        caps = {}
        for _, row in df.iterrows():
            id_ = int(row["ID"])
            import_mw = float(row.get("Import (MW)") or 0.0)
            export_mw = float(row.get("Export (MW)") or 0.0)
            caps[id_] = {"import_mw": import_mw, "export_mw": export_mw}
        _logger.info(
            "Capacités interconnexions chargées : %d postes (import max=%.0f MW, export max=%.0f MW)",
            len(caps),
            max(v["import_mw"] for v in caps.values()) if caps else 0,
            max(v["export_mw"] for v in caps.values()) if caps else 0,
        )
        return caps
    except Exception as exc:
        _logger.warning("Impossible de charger les capacités interconnexions : %s", exc)
        return {}


def _add_interconnection_links(
    network: pypsa.Network,
    buses_df: Any,
    lines_df: Any = None,
) -> None:
    """Crée les Links + market generators pour les interconnexions frontalières.

    Pour chaque paire Interco↔Étranger :
    - Link (bus0=Interco, bus1=Étranger) : flux physique, capacité asymétrique
        p_min_pu = -import_cap/p_nom  (import : flux Étranger→Interco, p0<0)
        p_max_pu = +export_cap/p_nom  (export : flux Interco→Étranger, p0>0)
    - Generator "market" au bus Étranger : modèle du marché extérieur
        p_min_pu = -export_cap/p_nom  (absorbe nos exports)
        p_max_pu = +import_cap/p_nom  (fournit des imports)
        marginal_cost = _MARKET_PRICE_IMPORT_CAD_MWH
        → import coûte _MARKET_PRICE $/MWh, export rapporte _MARKET_PRICE $/MWh

    Fallback de capacité : si l'ID du bus Interco ne figure pas dans le xlsx,
    on utilise _DEFAULT_INTERCO_CAP_MW dans les deux sens.

    Remarque sur la dérivation des signes (KCL au bus Étranger) :
        p_gen_étranger = -p0_link  (convention PyPSA, efficiency=1)
        Import (p0<0) → p_gen>0 → Generator produit → coût += MARKET_PRICE * p_gen ✓
        Export (p0>0) → p_gen<0 → Generator absorbe → coût -= MARKET_PRICE * |p_gen| ✓
    """
    if not isinstance(buses_df, pd.DataFrame) or buses_df.empty:
        return
    if len(network.buses) == 0:
        return

    interco_caps = _load_interco_capacities()

    # Choisir la source des paires Interco↔Étranger
    if isinstance(lines_df, pd.DataFrame) and not lines_df.empty:
        rows_iter = lines_df.iterrows()
    elif len(network.lines) > 0:
        rows_iter = network.lines.reset_index().iterrows()
    else:
        return

    existing_link_names = set(network.links.index) if len(network.links) > 0 else set()
    existing_gen_names = set(network.generators.index) if len(network.generators) > 0 else set()

    for _, row in rows_iter:
        bus0 = str(row.get("bus0", ""))
        bus1 = str(row.get("bus1", ""))

        interco_bus = etranger_bus = None
        if bus0.startswith("Interco") and bus1.startswith("Etranger"):
            interco_bus, etranger_bus = bus0, bus1
        elif bus1.startswith("Interco") and bus0.startswith("Etranger"):
            interco_bus, etranger_bus = bus1, bus0

        if interco_bus is None:
            continue
        if interco_bus not in network.buses.index or etranger_bus not in network.buses.index:
            continue

        link_name = f"link_{interco_bus}_{etranger_bus}"
        if link_name in existing_link_names:
            continue

        # Récupérer les capacités depuis le xlsx (par ID du bus Interco)
        m = re.search(r"\d+$", interco_bus)
        interco_id = int(m.group()) if m else -1
        cap = interco_caps.get(interco_id, {})
        import_mw = cap.get("import_mw", _DEFAULT_INTERCO_CAP_MW)
        export_mw = cap.get("export_mw", _DEFAULT_INTERCO_CAP_MW)

        # p_nom = capacité maximale dans le sens le plus contraignant
        p_nom = max(import_mw, export_mw)
        if p_nom <= 0:
            p_nom = _DEFAULT_INTERCO_CAP_MW

        # Link physique entre Interco et Étranger
        network.add(
            "Link",
            name=link_name,
            bus0=interco_bus,
            bus1=etranger_bus,
            p_nom=p_nom,
            p_min_pu=-import_mw / p_nom,   # flux max import (p0 négatif)
            p_max_pu=export_mw / p_nom,     # flux max export (p0 positif)
            efficiency=1.0,
            marginal_cost=0.0,              # coût sur le Generator côté Étranger
        )
        existing_link_names.add(link_name)

        # Générateur d'import au bus Étranger — marché extérieur fournit de la puissance.
        # p ≥ 0 seulement : active UNIQUEMENT quand HQ est en déficit.
        # Coût = MARKET_PRICE → moins cher que thermique mais plus cher que hydro.
        import_gen_name = f"market_{etranger_bus}_import"
        if import_gen_name not in existing_gen_names:
            network.add(
                "Generator",
                name=import_gen_name,
                bus=etranger_bus,
                p_nom=p_nom,
                p_min_pu=0.0,
                p_max_pu=import_mw / p_nom,
                marginal_cost=_MARKET_PRICE_IMPORT_CAD_MWH,
                carrier="import",
            )
            existing_gen_names.add(import_gen_name)

        # Puits d'export au bus Étranger — absorbe le surplus HQ.
        # p ≤ 0 seulement : active UNIQUEMENT quand la production interne dépasse la demande.
        #
        # Convention PyPSA (objectif) : coût = marginal_cost × p × poids_snapshot
        #   → p < 0 et marginal_cost = +_MARKET_PRICE ⟹ contribution NÉGATIVE = REVENU
        #   → symétriquement : importer coûte +30 $/MWh, exporter rapporte +30 $/MWh
        #
        # Cela incite le LP à exporter le surplus d'hydro_fil (énergie fatale) plutôt
        # que de le curtailler, en faisant de l'export une source de revenu réelle.
        if export_mw > 0:
            export_gen_name = f"market_{etranger_bus}_export"
            if export_gen_name not in existing_gen_names:
                network.add(
                    "Generator",
                    name=export_gen_name,
                    bus=etranger_bus,
                    p_nom=p_nom,
                    p_min_pu=-export_mw / p_nom,
                    p_max_pu=0.0,
                    marginal_cost=_MARKET_PRICE_EXPORT_CAD_MWH,   # revenu NET export (< prix import)
                    carrier="export",
                )
                existing_gen_names.add(export_gen_name)

        _logger.debug(
            "Interco %s : import=%.0f MW @ %.1f $/MWh, export=%.0f MW @ %.1f $/MWh (revenu net)",
            interco_bus, import_mw, _MARKET_PRICE_IMPORT_CAD_MWH, export_mw, _MARKET_PRICE_EXPORT_CAD_MWH,
        )
