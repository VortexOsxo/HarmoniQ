"""Template de construction du reseau PyPSA aligne sur les variables HarmoniQ."""

import logging
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
import pypsa

_logger = logging.getLogger(__name__)

# Prix de marché des échanges transfrontaliers (symétrique import/export).
# Au-dessus du coût thermique (25 $/MWh) pour que l'OPF utilise toutes les
# sources locales avant d'importer. Valeur raisonnable pour le marché HQ/NE.
_MARKET_PRICE_CAD_MWH = 30.0

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
    "hydro_fil":        0.90,
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

    # Déclarer les carriers pour éviter les warnings PyPSA 1.0+ et
    # permettre la reconstitution de la production par carrier dans results.py.
    _add_carriers(network)

    _add_buses(network, topology.get("buses"))
    _add_line_types(network, topology.get("line_types"))
    _add_lines(network, topology.get("lines"))
    _add_generators(network, generation_profiles.get("generators"))
    _add_loads_on_conso_buses(network, topology.get("buses"))
    # Passer lines_df explicitement : les lignes Interco→Etranger sont skippées
    # dans _add_lines() et créées ici comme Links bidirectionnels PyPSA.
    _add_interconnection_links(network, topology.get("buses"), topology.get("lines"))

    # Rattacher les series temporelles si elles sont fournies
    p_max_pu = generation_profiles.get("p_max_pu")
    if isinstance(p_max_pu, pd.DataFrame):
        network.generators_t.p_max_pu = p_max_pu.reindex(index=network.snapshots, fill_value=1.0)

    # Priorité de dispatch des sources non pilotables (éolien, solaire, hydro fil de l'eau) :
    # En LP-OPF, le "must-run" se traduit par un signal de coût quasi-nul (0.1 $/MWh),
    # PAS par une contrainte dure p_min_pu = p_max_pu.
    #
    # Pourquoi pas de contrainte dure ?
    # En été, éolien + hydro_fil peuvent dépasser la demande locale.
    # Si p_min = p_max est forcé → bilan offre/demande impossible → OPF infaisable.
    # En LP, l'optimizer dispatch toujours en priorité les sources à coût ≈ 0,
    # et curtaile uniquement si la contrainte réseau ou le bilan l'exige
    # (congestion, surproduction > demande + exports possibles).
    #
    # p_min_pu = 0 pour tous les générateurs (défaut PyPSA) — piloté par le coût marginal.
    _logger.info(
        "Dispatch par mérite : éolien/solaire/hydro_fil prioritaires (coût 0.1 $/MWh, "
        "p_min_pu=0 — curtailment autorisé si surproduction ou congestion réseau)"
    )

    marginal_cost = generation_profiles.get("marginal_cost")
    if isinstance(marginal_cost, pd.DataFrame):
        network.generators_t.marginal_cost = marginal_cost.reindex(index=network.snapshots).fillna(0.0)

    if isinstance(demand_profile, pd.DataFrame):
        network.loads_t.p_set = demand_profile.reindex(index=network.snapshots).fillna(0.0)

    return network


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
        kwargs = {k: row[k] for k in ["type", "length", "capital_cost", "num_parallel"] if k in lines_df.columns}
        # s_nom doit être multiplié par num_parallel manuellement : PyPSA utilise
        # num_parallel pour scaler x/r (impédance) mais PAS pour la limite thermique LP.
        s_nom_base  = float(row.get("s_nom") or 0)
        n_par       = float(row.get("num_parallel") or 1)
        kwargs["s_nom"] = s_nom_base * n_par
        network.add("Line", name=name, bus0=bus0, bus1=bus1, **kwargs)


def _add_generators(network: pypsa.Network, generators_df: Any) -> None:
    if not isinstance(generators_df, pd.DataFrame) or generators_df.empty:
        return

    for _, row in generators_df.iterrows():
        name = str(row.get("name") or "")
        bus  = str(row.get("bus")  or "")
        if not name or not bus:
            continue

        kwargs = {
            k: row[k]
            for k in ["carrier", "p_nom", "p_nom_extendable", "p_nom_min", "p_nom_max", "marginal_cost"]
            if k in generators_df.columns
        }
        network.add("Generator", name=name, bus=bus, **kwargs)


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
        marginal_cost = _MARKET_PRICE_CAD_MWH
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
                marginal_cost=_MARKET_PRICE_CAD_MWH,
                carrier="import",
            )
            existing_gen_names.add(import_gen_name)

        # Puits d'export au bus Étranger — absorbe le surplus HQ.
        # p ≤ 0 seulement : active UNIQUEMENT quand la production interne dépasse la demande.
        # marginal_cost = +0.001 $/MWh : contribution objective = 0.001 * (p<0) < 0, soit une
        # très légère préférence pour l'export plutôt que le curtailment — sans jamais inciter
        # à surproduire (0.001 << coût marginal hydro 0.1-100 $/MWh).
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
                    marginal_cost=0.001,
                    carrier="export",
                )
                existing_gen_names.add(export_gen_name)

        _logger.debug(
            "Interco %s : import=%.0f MW @ %.1f $/MWh, export=%.0f MW @ 0 $/MWh",
            interco_bus, import_mw, _MARKET_PRICE_CAD_MWH, export_mw,
        )
