"""Extraction des resultats + formatage API avec alias de compatibilite."""

import math
from typing import Any, Dict, List
import pandas as pd
import pypsa


CARRIER_ALIAS_MAP = {
    "nuclaire": "nucleaire",
    "nucléaire": "nucleaire",
}


def get_results_todo_list() -> List[str]:
    """Liste actionnable des evolutions de sortie a implementer."""
    return [
        "Ajouter les KPI import/export energies (MWh) dans summary.",
        "Ajouter les KPI de pertes reseau si `pf/lpf` disponible.",
        "Stabiliser le schema de sortie pour le frontend Angular (timestamp/snapshot).",
        "Ajouter une validation stricte du contrat de sortie avant retour API.",
    ]


def extract_kpis(network: pypsa.Network, optimizer_result: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Extrait la production, les métriques lignes et les KPI de synthèse.

    Paramètres
    ----------
    network         : réseau PyPSA après optimize() + pf()/lpf()
    optimizer_result: dict retourné par run_dispatch_and_flow() (optionnel).
                      S'il est fourni, les constraint_warnings et was_relaxed
                      sont inclus dans la réponse.

    Retourne un dict avec :
        production_df       — DataFrame index=snapshots, colonnes par carrier
        line_flows          — liste de dicts par ligne (flux, chargement %)
        violations          — lignes surchargées selon s_nom courant
        constraint_warnings — lignes surchargées selon s_nom ORIGINAL (si relâchement)
        link_flows          — flux aux interconnexions (Links PyPSA)
        summary             — KPI globaux (énergie, pertes, import/export)
        was_relaxed         — bool : les contraintes thermiques ont été relâchées
    """
    production = pd.DataFrame(index=network.snapshots)

    if hasattr(network, "generators_t") and "p" in network.generators_t:
        p = network.generators_t["p"]
        production["totale"] = p.sum(axis=1)

        if len(network.generators) > 0 and "carrier" in network.generators.columns:
            for carrier in network.generators.carrier.unique():
                canonical = _canonical_carrier(str(carrier))
                gens = network.generators.index[network.generators.carrier == carrier]
                production[f"total_{canonical}"] = p.reindex(columns=gens, fill_value=0.0).sum(axis=1)

    # Import/export par snapshot depuis les Links (interconnexions).
    # Les imports/exports ne sont PAS des générateurs — ils transitent via des Links PyPSA
    # et sont donc absents de generators_t.p.  On les extrait de links_t.p0 :
    #   p0 > 0  → export HQ vers étranger (flux sortant du bus Interco)
    #   p0 < 0  → import étranger vers HQ  (flux entrant au bus Interco)
    if hasattr(network, "links_t") and "p0" in network.links_t and not network.links_t.p0.empty:
        p0_links = network.links_t.p0
        production["total_import"] = (
            p0_links.clip(upper=0).abs().sum(axis=1).reindex(production.index, fill_value=0.0)
        )
        production["total_export"] = (
            p0_links.clip(lower=0).sum(axis=1).reindex(production.index, fill_value=0.0)
        )
    else:
        if "total_import" not in production.columns:
            production["total_import"] = 0.0
        if "total_export" not in production.columns:
            production["total_export"] = 0.0

    # Le frontend legacy attend total_nucleaire
    if "total_nucleaire" not in production.columns:
        production["total_nucleaire"] = 0.0

    line_flows = []
    if hasattr(network, "lines_t") and "p0" in network.lines_t and len(network.lines_t["p0"].columns) > 0:
        p0 = network.lines_t["p0"]
        max_flow = p0.abs().max()

        for line_name, value in max_flow.items():
            s_nom = None
            loading_percent = None
            if line_name in network.lines.index and "s_nom" in network.lines.columns:
                s_nom = float(network.lines.at[line_name, "s_nom"])
                if s_nom > 0:
                    loading_percent = float(value / s_nom * 100.0)
            line_flows.append(
                {
                    "line": line_name,
                    "max_flow_mw": float(value),
                    "s_nom_mva": s_nom,
                    "loading_percent": loading_percent,
                }
            )

    # Lignes en surcharge (chargement > 100% de s_nom)
    violations = [
        {
            "line": f["line"],
            "loading_percent": f["loading_percent"],
            "max_flow_mw": f["max_flow_mw"],
            "s_nom_mva": f["s_nom_mva"],
        }
        for f in line_flows
        if f["loading_percent"] is not None and f["loading_percent"] > 100.0
    ]

    # Poids temporels : 1h/snapshot en horaire, 168h/snapshot en hebdomadaire
    snap_weights = network.snapshot_weightings.generators if hasattr(network, "snapshot_weightings") else None

    # Import/export via Links (interconnexions frontieres)
    link_flows = []
    if hasattr(network, "links_t") and "p0" in network.links_t and len(network.links_t["p0"].columns) > 0:
        p0_links = network.links_t["p0"]
        for link_name in p0_links.columns:
            vals = p0_links[link_name]
            if snap_weights is not None:
                w = snap_weights.reindex(vals.index, fill_value=1.0)
                export_mwh = float((vals.clip(lower=0) * w).sum())
                import_mwh = float((vals.clip(upper=0).abs() * w).sum())
            else:
                export_mwh = float(vals[vals > 0].sum())
                import_mwh = float(vals[vals < 0].abs().sum())
            link_flows.append({
                "link": link_name,
                "total_export_mwh": export_mwh,
                "total_import_mwh": import_mwh,
                "max_export_mw": float(vals.max()),
                "max_import_mw": float(vals.min()),
            })

    # Pertes réseau :
    #   - AC PF (pf_done / pf_internal_done) : p0 + p1 ≠ 0  → pertes exactes I²R
    #   - LPF (lpf_*)                        : p0 + p1 = 0 par construction (DC lossless)
    #                                          → estimation via P²R/V² (DC approximation)
    total_losses_mwh = 0.0
    flow_status = optimizer_result.get("flow_status", "") if optimizer_result else ""
    ac_pf_converged = flow_status in ("pf_done", "pf_internal_done")

    if hasattr(network, "lines_t") and "p0" in network.lines_t and not network.lines_t.p0.empty:
        p0_df = network.lines_t.p0
        if ac_pf_converged and "p1" in network.lines_t and not network.lines_t.p1.empty:
            # AC PF convergé : pertes exactes (p1 ≠ -p0), pondérées par snap_weights
            losses_per_snap = (p0_df + network.lines_t.p1).abs().sum(axis=1)
            if snap_weights is not None:
                total_losses_mwh = float((losses_per_snap * snap_weights).sum())
            else:
                total_losses_mwh = float(losses_per_snap.sum())
        else:
            # LPF : p1 = -p0 → estimation DC via P²R/V²
            total_losses_mwh = _estimate_dc_losses_from_lpf(network, p0_df, snap_weights)

    summary = {
        "n_buses": int(len(network.buses)) if hasattr(network, "buses") else 0,
        "n_lines": int(len(network.lines)) if hasattr(network, "lines") else 0,
        "n_generators": int(len(network.generators)) if hasattr(network, "generators") else 0,
        "total_energy_mwh": float((production["totale"] * snap_weights).sum()) if ("totale" in production.columns and snap_weights is not None) else float(production["totale"].sum()) if "totale" in production.columns else 0.0,
        "n_violations": len(violations),
        "total_losses_mwh": total_losses_mwh,
        "total_export_mwh": sum(lf["total_export_mwh"] for lf in link_flows),
        "total_import_mwh": sum(lf["total_import_mwh"] for lf in link_flows),
    }

    # Enrichir le résumé avec les pertes (disponibles après AC PF)
    summary["total_losses_mwh"] = total_losses_mwh
    summary["losses_percent"] = (
        round(total_losses_mwh / summary["total_energy_mwh"] * 100, 2)
        if summary["total_energy_mwh"] > 0 else 0.0
    )

    # Intégrer les résultats de l'optimizer si fournis
    was_relaxed         = False
    constraint_warnings: List[Dict[str, Any]] = []
    if optimizer_result is not None:
        was_relaxed         = bool(optimizer_result.get("was_relaxed", False))
        constraint_warnings = optimizer_result.get("constraint_warnings", [])
    summary["was_relaxed"]          = was_relaxed
    summary["n_constraint_warnings"] = len(constraint_warnings)

    infra_report = _compute_infra_report(network)

    summary["n_infra_additions"] = len(infra_report)

    # --- Niveau moyen des réservoirs (pour viz) ---
    # Extrait le coût marginal moyen des réservoirs par snapshot → proxy du fill level.
    # Le coût est l'inverse du fill (calibré via _water_value_cost) :
    #   coût bas (~3 $/MWh) → réservoir plein ;  coût haut (~80 $/MWh) → réservoir vide.
    reservoir_cost_ts = None
    if hasattr(network, "generators_t") and "marginal_cost" in network.generators_t:
        mc = network.generators_t.marginal_cost
        reservoir_gens = network.generators.index[
            network.generators.carrier == "hydro_reservoir"
        ]
        rc = [g for g in reservoir_gens if g in mc.columns]
        if rc:
            # Moyenne pondérée par p_nom
            pnoms = network.generators.loc[rc, "p_nom"]
            weights = pnoms / pnoms.sum() if pnoms.sum() > 0 else pd.Series(1.0, index=pnoms.index)
            reservoir_cost_ts = (mc[rc] * weights).sum(axis=1)

    return {
        "production_df":        production,
        "line_flows":           line_flows,
        "violations":           violations,
        "constraint_warnings":  constraint_warnings,
        "link_flows":           link_flows,
        "summary":              summary,
        "was_relaxed":          was_relaxed,
        "infra_report":         infra_report,
        "reservoir_cost_ts":    reservoir_cost_ts,
    }


def format_api_response(
    *,
    scenario_id: int,
    liste_infra_id: int,
    is_journalier: bool,
    kpis: Dict[str, Any],
    execution_time_seconds: float,
) -> Dict[str, Any]:
    """Formate la reponse avec compatibilite legacy et nouveaux clients."""
    production_df = kpis["production_df"].copy()

    # Conserver la convention backend legacy: `timestamp`
    production_json = production_df.reset_index().rename(columns={"index": "timestamp"})

    if "timestamp" in production_json.columns:
        production_json["timestamp"] = production_json["timestamp"].astype(str)
        # Alias de compatibilite pour les clients qui utilisaient `snapshot`
        production_json["snapshot"] = production_json["timestamp"]

    return {
        "metadata": {
            "scenario_id":            scenario_id,
            "liste_infra_id":         liste_infra_id,
            "is_journalier":          is_journalier,
            "execution_time_seconds": execution_time_seconds,
            "timestamps":             len(production_df),
        },
        "production":           production_json.to_dict(orient="records"),
        "line_flows":           kpis["line_flows"],
        "violations":           kpis["violations"],
        "constraint_warnings":  kpis.get("constraint_warnings", []),
        "link_flows":           kpis["link_flows"],
        "summary":              kpis["summary"],
        "was_relaxed":          kpis.get("was_relaxed", False),
        "infra_report":         kpis.get("infra_report", []),
    }


def _estimate_dc_losses_from_lpf(network: pypsa.Network, p0_df: pd.DataFrame, snap_weights=None) -> float:
    """Estime les pertes I²R depuis le flux LPF (DC).

    Formule 3-phases équilibré :  P_loss [MW] = P0_capped [MW]² × R [Ω] / V_nom [kV]²

    Notes :
    - R [Ω] est calculé par PyPSA lors du PF (r_per_length × length / num_parallel).
    - Le flux LPF est PLAFONNÉ à s_nom avant le calcul : le LPF distribue sans
      contraintes thermiques (contrairement à l'OPF), ce qui peut donner des flux
      35× supérieurs à s_nom sur les lignes de collecte → pertes absurdes sans cap.
    - Cette estimation reste une approximation DC ; les pertes AC réelles nécessitent
      un AC Newton-Raphson convergé (flow_status == "pf_done").
    - La somme sur tous les snapshots donne des MWh.
    """
    if "r" not in network.lines.columns:
        return 0.0

    total = 0.0
    for line_name in p0_df.columns:
        if line_name not in network.lines.index:
            continue
        r_ohm = float(network.lines.at[line_name, "r"])
        if r_ohm <= 0:
            continue
        bus0 = network.lines.at[line_name, "bus0"]
        if bus0 not in network.buses.index:
            continue
        v_nom = float(network.buses.at[bus0, "v_nom"])
        if v_nom <= 0:
            continue
        # Plafonner le flux LPF à s_nom pour éviter l'explosion des pertes
        # sur les lignes de collecte (LPF distribue sans contraintes thermiques,
        # certaines lignes 230kV reçoivent 35× leur capacité nominale).
        # On exclut aussi les liens Interco↔Étranger (hors territoire).
        s_nom = network.lines.at[line_name, "s_nom"] if "s_nom" in network.lines.columns else None
        if s_nom is not None and s_nom > 0:
            p_series = p0_df[line_name].clip(-float(s_nom), float(s_nom))
        else:
            p_series = p0_df[line_name]
        # Pertes par snapshot [MW], pondérées par snap_weights → MWh
        losses_series = p_series ** 2 * r_ohm / v_nom ** 2
        if snap_weights is not None:
            w = snap_weights.reindex(losses_series.index, fill_value=1.0)
            total += float((losses_series * w).sum())
        else:
            total += float(losses_series.sum())

    return total


def _compute_infra_report(network: pypsa.Network) -> List[Dict[str, Any]]:  # noqa: C901
    """Rapport d'infrastructure : lignes dont la capacité actuelle (réseau 2026)
    est insuffisante pour la demande simulée (2035).

    Deux sources :
    1. auto_scale_line_capacities() — ajustements pré-OPF stockés sur network._infra_scaling_changes.
       Ces lignes ont été renforcées pour que l'OPF soit faisable ; leurs circuits originaux
       (s_nom_original) sont inférieurs au requis.
    2. Flux post-OPF (lines_t.p0) — lignes encore surchargées après dispatch optimal.

    Retourne une liste dédupliquée triée par % de surcharge décroissant.
    """
    seen: set = set()
    report: List[Dict[str, Any]] = []

    has_original = "s_nom_original" in network.lines.columns
    has_per_circuit = "s_nom_per_circuit" in network.lines.columns

    def _bus_vnom(bus0: str) -> int | None:
        return int(network.buses.at[bus0, "v_nom"]) if bus0 in network.buses.index else None

    def _line_meta(line_name: str):
        row = network.lines.loc[line_name] if line_name in network.lines.index else None
        bus0 = str(row["bus0"]) if row is not None and "bus0" in network.lines.columns else "?"
        bus1 = str(row["bus1"]) if row is not None and "bus1" in network.lines.columns else "?"
        ltype = str(row["type"]) if row is not None and "type" in network.lines.columns else "?"
        return bus0, bus1, ltype

    # --- Source 1 : auto_scale (lignes renforcées avant OPF) ---
    for ch in getattr(network, "_infra_scaling_changes", []):
        line_name = ch.get("line", "")
        if not line_name or line_name not in network.lines.index:
            continue
        if line_name in seen:
            continue
        seen.add(line_name)

        s_nom_original = ch["old_s_nom"]
        s_nom_needed   = ch["new_s_nom"]
        s_nom_pc       = float(network.lines.at[line_name, "s_nom_per_circuit"]) if has_per_circuit else (s_nom_original or 2000.0)
        nb_current     = max(1, round(s_nom_original / s_nom_pc))
        nb_needed      = ch["num_parallel"]
        bus0, bus1, ltype = _line_meta(line_name)

        report.append({
            "line":                  line_name,
            "bus0":                  bus0,
            "bus1":                  bus1,
            "voltage_kv":            _bus_vnom(bus0),
            "line_type":             ltype,
            "nb_circuits_current":   nb_current,
            "nb_circuits_needed":    nb_needed,
            "nb_circuits_to_add":    nb_needed - nb_current,
            "s_nom_per_circuit_mva": round(s_nom_pc, 1),
            "s_nom_current_mva":     round(s_nom_original, 1),
            "s_nom_needed_mva":      round(s_nom_needed, 1),
            "max_flow_mw":           None,
            "overload_pct":          round(s_nom_needed / max(s_nom_original, 1) * 100.0, 1),
            "reason": (
                f"Capacité actuelle {s_nom_original:.0f} MVA ({nb_current} circuit{'s' if nb_current>1 else ''}) "
                f"insuffisante — {ch['reason']}. "
                f"Réseau 2026 vs demande 2035 : +{nb_needed - nb_current} circuit(s) requis."
            ),
        })

    # --- Source 2 : flux post-OPF encore surchargés ---
    if hasattr(network, "lines_t") and "p0" in network.lines_t and not network.lines_t.p0.empty:
        p0 = network.lines_t.p0
        for line_name in p0.columns:
            if line_name in seen or line_name not in network.lines.index:
                continue
            max_flow    = float(p0[line_name].abs().max())
            if math.isnan(max_flow):
                continue  # OPF non convergé pour cette ligne
            s_nom_total = float(network.lines.at[line_name, "s_nom"])
            if s_nom_total <= 0 or max_flow <= s_nom_total:
                continue
            s_nom_pc    = float(network.lines.at[line_name, "s_nom_per_circuit"]) if has_per_circuit else s_nom_total
            if math.isnan(s_nom_pc) or s_nom_pc <= 0:
                continue
            nb_current  = max(1, round(s_nom_total / max(s_nom_pc, 1)))
            nb_needed   = math.ceil(max_flow / max(s_nom_pc, 1))
            if nb_needed <= nb_current:
                continue
            seen.add(line_name)
            bus0, bus1, ltype = _line_meta(line_name)
            report.append({
                "line":                  line_name,
                "bus0":                  bus0,
                "bus1":                  bus1,
                "voltage_kv":            _bus_vnom(bus0),
                "line_type":             ltype,
                "nb_circuits_current":   nb_current,
                "nb_circuits_needed":    nb_needed,
                "nb_circuits_to_add":    nb_needed - nb_current,
                "s_nom_per_circuit_mva": round(s_nom_pc, 1),
                "s_nom_current_mva":     round(s_nom_total, 1),
                "s_nom_needed_mva":      round(nb_needed * s_nom_pc, 1),
                "max_flow_mw":           round(max_flow, 1),
                "overload_pct":          round(max_flow / s_nom_total * 100.0, 1),
                "reason": (
                    f"Flux simulé {max_flow:.0f} MW > capacité {s_nom_total:.0f} MVA "
                    f"({nb_current} circuit{'s' if nb_current>1 else ''} × {s_nom_pc:.0f} MVA). "
                    f"Réseau 2026 insuffisant pour la demande 2035."
                ),
            })

    report.sort(key=lambda x: x["overload_pct"], reverse=True)
    return report


def _canonical_carrier(carrier: str) -> str:
    normalized = carrier.strip().lower()
    return CARRIER_ALIAS_MAP.get(normalized, normalized)
