"""Optimisation LP-DC + écoulement de puissance AC.

Séquence normale :
    1. network.optimize(solver_name)  → LP-OPF DC : dispatch optimal (minimise coûts)
    2. network.pf()                   → AC power flow : tensions, Q, chargement MVA réel

Règle de robustesse :
    Si l'OPF est infaisable (ex. nouvelle centrale dépasse la capacité des lignes),
    on relâche toutes les contraintes thermiques (s_nom → 99999), on relance,
    puis on flague les lignes surchargées dans constraint_warnings.
    La simulation retourne toujours un résultat.
"""

import gc
import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pypsa

from .utils.reservoir_tracker import ReservoirDamFeed, water_value_cost

logger = logging.getLogger(__name__)

_RELAX_SNOM = 99_999.0   # MVA non-contraignant

# Prime hivernale sur la valeur de l'eau ($/MWh) — Jan à Déc
# Dupliquée depuis data_loader pour éviter l'import circulaire.
# Relevée pour que le water value hivernal (base ~6.5 $/MWh + prime) dépasse
# le prix import Ontario (15 $/MWh) → LP importe en pointe jan/fév/déc
# plutôt que de dépléter les réservoirs stratégiques.
_WINTER_PREMIUM = [12.0, 12.0, 3.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0, 5.0, 12.0]


def get_optimizer_todo_list() -> List[str]:
    """Liste actionnable des éléments à implémenter dans l'optimiseur."""
    return [
        "Ajouter la logique de pilotage import/export via Links (limites horaires).",
        "Ajouter un mode journalier cohérent (agrégation des snapshots).",
        "Calibrer les pénalités de curtailment si nécessaire.",
    ]


def run_dispatch_and_flow(
    network: pypsa.Network,
    mode: str = "dc+ac",
    solver_name: str = "highs",
    reservoir_feed: Optional[List[ReservoirDamFeed]] = None,
) -> Dict[str, Any]:
    """Exécute le dispatch LP-DC puis l'écoulement de puissance.

    Modes disponibles :
        "dc"    — LOPF seul (dispatch optimal, pas de pertes calculées)
        "ac"    — LOPF puis Newton-Raphson PF (pertes + tensions + chargement MVA)
        "dc+ac" — alias de "ac" (par défaut)

    Retourne un dict avec :
        status              : "ok" | "ok_with_relaxation"
        was_relaxed         : bool — True si les contraintes thermiques ont été relâchées
        constraint_warnings : liste des lignes surchargées (après relâchement si applicable)
        optimization_status : statut brut du solveur HiGHS
        flow_mode           : mode d'écoulement effectivement utilisé
        flow_status         : résultat du PF ("pf_done" | "lpf_done" | "lpf_fallback")
    """
    # Normaliser le mode
    effective_mode = "ac" if mode in ("ac", "dc+ac") else "dc"

    # --- Dispatch LP-OPF avec fallback ---
    opt_status, opt_detail, was_relaxed, original_snoms = _run_dispatch_with_fallback(
        network, solver_name=solver_name, reservoir_feed=reservoir_feed
    )

    # --- Écoulement de puissance ---
    flow_status = _run_power_flow(network, mode=effective_mode, was_relaxed=was_relaxed)

    # --- Identifier les lignes/liens surchargés ---
    constraint_warnings = _build_constraint_warnings(network, original_snoms)
    constraint_warnings += _build_link_warnings(network)

    overall_status = "ok_with_relaxation" if was_relaxed else "ok"
    if opt_status not in ("ok", "optimal"):
        overall_status = "warning"

    return {
        "status":               overall_status,
        "was_relaxed":          was_relaxed,
        "constraint_warnings":  constraint_warnings,
        "optimization_status":  opt_status,
        "optimization_detail":  opt_detail,
        "flow_mode":            effective_mode,
        "flow_status":          flow_status,
    }


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def _run_dispatch_with_fallback(
    network: pypsa.Network,
    solver_name: str = "highs",
    reservoir_feed: Optional[List[ReservoirDamFeed]] = None,
) -> Tuple[str, str, bool, Optional[pd.Series]]:
    """LP-OPF avec fallback automatique si infaisable.

    Séquence de relâchement :
      1. OPF normal (vrais s_nom + vraies capacités d'interconnexion)
      2. Si infaisable → relâcher contraintes thermiques des lignes (s_nom → 99999)
         ET relâcher les capacités d'export des interconnexions (Link p_max_pu → 1.0)
         afin qu'un surplus de production puisse toujours être évacué.
      3. Si toujours infaisable → restaurer et retourner l'erreur.

    Retourne (status, detail, was_relaxed, original_snoms).
    original_snoms est la Series des s_nom AVANT relâchement (None si pas relâché).
    """
    # Premier essai avec les vrais s_nom
    status, condition = _run_dispatch(network, solver_name, reservoir_feed=reservoir_feed)

    if status == "ok":
        return status, condition, False, None

    # Infaisable ou erreur → relâcher contraintes thermiques ET capacités d'export
    logger.warning(
        "OPF infaisable (status=%s, %s) — relâchement des contraintes thermiques et d'export…",
        status, condition,
    )
    original_snoms = network.lines["s_nom"].copy() if len(network.lines) > 0 else None
    original_link_pmax, original_gen_pmax, original_gen_pmin = _save_interco_limits(network)

    if original_snoms is not None:
        network.lines["s_nom"] = _RELAX_SNOM
    _relax_interco_export(network)

    status2, condition2 = _run_dispatch(network, solver_name, reservoir_feed=reservoir_feed)

    if status2 == "ok":
        logger.info(
            "OPF convergé après relâchement des contraintes thermiques + export interco. "
            "Vérifier constraint_warnings pour les lignes/liens surchargés."
        )
        return status2, condition2, True, original_snoms

    # Si même sans contraintes ça ne converge pas → restaurer et retourner l'erreur
    logger.error("OPF toujours infaisable après relâchement : %s / %s", status2, condition2)
    if original_snoms is not None:
        network.lines["s_nom"] = original_snoms
    _restore_interco_limits(network, original_link_pmax, original_gen_pmax, original_gen_pmin)
    return status2, condition2, False, None


def _save_interco_limits(
    network: pypsa.Network,
) -> Tuple[Optional[pd.Series], Optional[pd.Series], Optional[pd.Series]]:
    """Sauvegarde p_max_pu des Links et des market generators Étranger."""
    link_pmax = network.links["p_max_pu"].copy() if len(network.links) > 0 else None
    market_mask = (
        network.generators.index.str.startswith("market_")
        if len(network.generators) > 0 else pd.Series(dtype=bool)
    )
    gen_pmax = network.generators.loc[market_mask, "p_max_pu"].copy() if market_mask.any() else None
    gen_pmin = network.generators.loc[market_mask, "p_min_pu"].copy() if market_mask.any() else None
    return link_pmax, gen_pmax, gen_pmin


def _relax_interco_export(network: pypsa.Network) -> None:
    """Relâche les capacités d'interconnexion pour évacuer un surplus de production.

    - Links : p_max_pu → 1.0 (export), p_min_pu → -1.0 (import)
    - Générateurs market_*_import (p_max_pu > 0) : relâche uniquement p_max_pu → 1.0
    - Générateurs market_*_export (p_max_pu = 0) : relâche uniquement p_min_pu → -1.0
    Ne jamais croiser les champs : le générateur d'export ne doit jamais produire (p>0).
    """
    if len(network.links) > 0:
        network.links["p_max_pu"] = 1.0   # export illimité (direction positive)
        network.links["p_min_pu"] = -1.0  # import illimité (direction négative)
    if len(network.generators) == 0:
        return
    market_indices = [idx for idx in network.generators.index if idx.startswith("market_")]
    for idx in market_indices:
        if network.generators.at[idx, "p_max_pu"] > 0:
            # Générateur d'import : relâcher la capacité maximale d'import
            network.generators.at[idx, "p_max_pu"] = 1.0
        else:
            # Puits d'export : relâcher la capacité maximale d'export (direction négative)
            network.generators.at[idx, "p_min_pu"] = -1.0


def _restore_interco_limits(
    network: pypsa.Network,
    link_pmax: Optional[pd.Series],
    gen_pmax: Optional[pd.Series],
    gen_pmin: Optional[pd.Series],
) -> None:
    """Restaure les capacités d'interconnexion originales."""
    if link_pmax is not None:
        network.links["p_max_pu"] = link_pmax
    if gen_pmax is not None:
        network.generators.loc[gen_pmax.index, "p_max_pu"] = gen_pmax
    if gen_pmin is not None:
        network.generators.loc[gen_pmin.index, "p_min_pu"] = gen_pmin


def _patch_zero_reactance_lines(network: pypsa.Network) -> None:
    """Force x = max(x, 1e-4) sur les lignes avec réactance nulle.

    x=0 donne B=1/x=∞ → matrice Kirchhoff singulière → crash linopy.
    Typique pour les jeux de barres coupleurs (même emplacement géographique,
    length=0). Une réactance de 1e-4 pu n'affecte pas le dispatch.
    """
    if len(network.lines) == 0:
        return
    zero_x = network.lines["x"] <= 0
    if not zero_x.any():
        return
    logger.warning(
        "Patch réactance nulle : %d ligne(s) avec x≤0 → x=1e-4. Lignes : %s",
        zero_x.sum(), list(network.lines.index[zero_x]),
    )
    network.lines.loc[zero_x, "x"] = 1e-4
    zero_r = zero_x & (network.lines["r"] <= 0)
    if zero_r.any():
        network.lines.loc[zero_r, "r"] = 1e-4


def _update_reservoir_costs_and_pmax(
    network: pypsa.Network,
    chunk_start_idx: int,
    chunk_end_idx: int,
    reservoir_feed: List[ReservoirDamFeed],
) -> None:
    """Bilan hydraulique du chunk terminé → mise à jour coût + p_max_pu pour le prochain chunk.

    Pour chaque barrage réservoir :
        1. Applique le bilan V[t+1] = V[t] + apport×Δt − dispatch×Δt sur le chunk
        2. Calcule le nouveau niveau [0-1] en fin de chunk
        3. Écrit water_value_cost(niveau) dans generators_t.marginal_cost[gname][next_chunk_sns]
        4. Écrit la contrainte de réserve dans generators_t.p_max_pu[gname][next_chunk_sns]

    Ne fait rien si reservoir_feed est vide ou si le chunk est le dernier.
    """
    snapshots   = network.snapshots
    n_total     = len(snapshots)
    next_start  = chunk_end_idx
    next_end    = min(next_start + (chunk_end_idx - chunk_start_idx), n_total)

    if next_start >= n_total:
        return  # dernier chunk : pas de prochain chunk à mettre à jour

    chunk_sns = snapshots[chunk_start_idx:chunk_end_idx]
    next_sns  = snapshots[next_start:next_end]

    gen_p = network.generators_t.get("p", pd.DataFrame())
    if gen_p.empty:
        return

    dt_seconds = (network.snapshot_weightings.generators.loc[chunk_sns] * 3600.0).values
    mc_df   = network.generators_t.get("marginal_cost", pd.DataFrame())
    pmax_df = network.generators_t.get("p_max_pu",      pd.DataFrame())

    for dam in reservoir_feed:
        if dam.nom not in gen_p.columns:
            continue

        dispatch_mw = gen_p[dam.nom].reindex(chunk_sns, fill_value=0.0).values
        volume_current = dam.current_level * dam.volume_max_m3

        for i in range(len(chunk_sns)):
            apport_idx   = chunk_start_idx + i
            inflow_m3    = dam.apport_m3s[apport_idx] * dt_seconds[i]
            fraction     = float(np.clip(
                (dispatch_mw[i] / dam.p_max_mw) if dam.p_max_mw > 0 else 0.0,
                0.0, 1.0,
            ))
            discharge_m3 = dam.debit_max_m3s * fraction * dt_seconds[i]
            volume_current = float(np.clip(
                volume_current + inflow_m3 - discharge_m3, 0.0, dam.volume_max_m3
            ))

        dam.current_level = volume_current / dam.volume_max_m3  # persisté pour le chunk suivant

        # Coût marginal pour le prochain chunk (avec prime hivernale)
        new_cost = float(water_value_cost(np.array([dam.current_level]))[0])
        if not mc_df.empty and dam.nom in mc_df.columns:
            premium = np.array([_WINTER_PREMIUM[ts.month - 1] for ts in next_sns])
            mc_df.loc[next_sns, dam.nom] = new_cost + premium

        # Contrainte de réserve stratégique (p_max_pu) pour le prochain chunk
        new_pmax = float(np.clip(
            np.interp(dam.current_level, [0.30, 0.45, 0.70], [0.15, 0.50, 0.95]),
            0.15, 0.95,
        ))
        if not pmax_df.empty and dam.nom in pmax_df.columns:
            pmax_df.loc[next_sns, dam.nom] = new_pmax

        logger.debug(
            "Feed-forward %s : chunk [%d:%d] → niveau=%.1f%% → coût=%.1f $/MWh, p_max_pu=%.2f",
            dam.nom, chunk_start_idx, chunk_end_idx,
            dam.current_level * 100, new_cost, new_pmax,
        )


def _run_dispatch(
    network: pypsa.Network,
    solver_name: str = "highs",
    reservoir_feed: Optional[List[ReservoirDamFeed]] = None,
) -> Tuple[str, str]:
    """LP-OPF DC via rolling horizon avec gc.collect() inter-chunks (PyPSA 1.x).

    PyPSA 1.x n'a qu'une formulation : "kirchhoff" qui construit un tableau dense
    (snapshots × lignes × cycles).  Le rolling horizon découpe l'année en blocs de
    240h (~10 jours) :
        240 × 302 × 63 × 8 bytes = 37 MB par chunk → faisable en RAM.

    Pourquoi ne pas utiliser optimize_with_rolling_horizon ?
    La fragmentation du heap Python s'accumule chunk par chunk sans gc.collect().
    Avec 25 chunks de 360h, HiGHS crashe avec "bad allocation" au chunk 19 et le
    fallback (qui relance toute l'année) échoue immédiatement : le heap est saturé.
    Ce loop custom appelle gc.collect() après chaque chunk et pré-alloue les
    DataFrames résultats pour éviter la réallocation.

    Avec horizon=240 et 8737 snapshots → ~37 itérations (≈ 10 jours/chunk).
    """
    snapshots = network.snapshots
    horizon   = min(240, len(snapshots))
    n_iter    = (len(snapshots) + horizon - 1) // horizon

    logger.info(
        "LOPF rolling horizon : %dh par chunk → %d itérations pour l'année",
        horizon, n_iter,
    )

    gen_cols  = network.generators.index
    link_cols = network.links.index if len(network.links) > 0 else pd.Index([])

    # Accumuler les résultats par chunk (concat en fin de boucle)
    # Évite les problèmes d'assignation .loc/.iloc sur une DatetimeIndex PyPSA
    # (erreur "setting an array element with a sequence" avec certaines versions
    # pandas quand l'index a été re-créé par network.set_snapshots).
    gen_chunks:  List[pd.DataFrame] = []
    link_chunks: List[pd.DataFrame] = []
    failed_chunks = 0

    for i in range(n_iter):
        start = i * horizon
        end   = min(start + horizon, len(snapshots))
        chunk_sns   = snapshots[start:end]
        chunk_label = f"{chunk_sns[0]}:{chunk_sns[-1]}"

        logger.info(
            "Optimizing network for snapshot horizon [%s] (%d/%d).",
            chunk_label, i + 1, n_iter,
        )

        try:
            _patch_zero_reactance_lines(network)
            status, condition = network.optimize(chunk_sns, solver_name=solver_name)
            ok = (status == "ok") or (str(condition).lower() in ("optimal", "ok"))

            if ok:
                if "p" in network.generators_t and not network.generators_t.p.empty:
                    # .loc[chunk_sns] : ne prendre QUE les snapshots de ce chunk.
                    # generators_t.p après optimize(chunk_sns) contient TOUS les
                    # snapshots du réseau (pas seulement chunk_sns) — on filtre ici.
                    gen_chunks.append(
                        network.generators_t.p.loc[chunk_sns].reindex(
                            columns=gen_cols, fill_value=0.0
                        )
                    )
                else:
                    gen_chunks.append(
                        pd.DataFrame(0.0, index=chunk_sns, columns=gen_cols)
                    )
                # Feed-forward hydraulique : mettre à jour le coût et le p_max_pu
                # des barrages réservoirs pour le prochain chunk, basé sur le
                # dispatch réel de ce chunk.
                if reservoir_feed:
                    _update_reservoir_costs_and_pmax(network, start, end, reservoir_feed)
                if len(link_cols) > 0:
                    if "p0" in network.links_t and not network.links_t.p0.empty:
                        link_chunks.append(
                            network.links_t.p0.loc[chunk_sns].reindex(
                                columns=link_cols, fill_value=0.0
                            )
                        )
                    else:
                        link_chunks.append(
                            pd.DataFrame(0.0, index=chunk_sns, columns=link_cols)
                        )
            else:
                logger.warning(
                    "Chunk %d/%d non-optimal : %s / %s",
                    i + 1, n_iter, status, condition,
                )
                gen_chunks.append(pd.DataFrame(0.0, index=chunk_sns, columns=gen_cols))
                if len(link_cols) > 0:
                    link_chunks.append(pd.DataFrame(0.0, index=chunk_sns, columns=link_cols))
                failed_chunks += 1

        except Exception as exc:
            logger.error("Chunk %d/%d failed : %s", i + 1, n_iter, exc)
            gen_chunks.append(pd.DataFrame(0.0, index=chunk_sns, columns=gen_cols))
            if len(link_cols) > 0:
                link_chunks.append(pd.DataFrame(0.0, index=chunk_sns, columns=link_cols))
            failed_chunks += 1

        finally:
            # Forcer le GC pour libérer la mémoire HiGHS et linopy du chunk précédent.
            # Sans cela, la fragmentation du heap Python s'accumule et provoque un
            # "bad allocation" vers le chunk 19 sur une machine 16 Go.
            gc.collect()

    # Consolider et stocker dans le réseau
    gen_p   = pd.concat(gen_chunks,  axis=0) if gen_chunks  else pd.DataFrame(0.0, index=snapshots, columns=gen_cols)
    link_p0 = pd.concat(link_chunks, axis=0) if link_chunks else None
    network.generators_t["p"] = gen_p
    if link_p0 is not None:
        network.links_t["p0"] = link_p0

    # Évaluer la couverture : > 5% des heures sans dispatch → fallback
    total_gen = gen_p.sum(axis=1)
    n_total   = len(total_gen)
    n_zero    = int((total_gen < 1.0).sum())

    if n_zero > int(0.05 * n_total):
        logger.warning(
            "Rolling horizon : %d/%d heures sans dispatch (%d chunks infaisables) "
            "→ fallback déclenché",
            n_zero, n_total, failed_chunks,
        )
        return "failed", f"{n_zero}/{n_total} heures sans dispatch"

    logger.info(
        "Rolling horizon convergé : %d/%d heures avec dispatch, %d chunks infaisables ✓",
        n_total - n_zero, n_total, failed_chunks,
    )
    return "ok", "optimal"


# ---------------------------------------------------------------------------
# Écoulement de puissance
# ---------------------------------------------------------------------------

def _run_power_flow(
    network: pypsa.Network,
    mode: str = "ac",
    was_relaxed: bool = False,
) -> str:
    """Écoulement de puissance après dispatch.

    Stratégie :
    - DC ou was_relaxed=True → LPF directement (rapide, toujours converge)
    - AC → essai Newton-Raphson; si la matrice est singulière ou non-convergent
      après 30 itérations → fallback automatique LPF

    La singularité survient quand des buses Etranger (nœuds flottants connectés
    uniquement via Links) créent des composantes déconnectées dans le réseau AC.
    Le LPF (linéarisé) ne souffre pas de ce problème.

    Important : lpf() / pf() redistribuent le slack sur generators_t.p et
    écrasent le dispatch LOPF.  On sauvegarde generators_t.p avant le PF et on
    le restaure après pour que extract_kpis() puisse lire le dispatch optimal.
    """
    # Sauvegarder les flux Links AVANT le PF : le LPF/PF peut écraser links_t.p0
    # (les Links sont des dispositifs contrôlés, pas des AC lines — leur flux
    # vient de l'OPF, pas du PF). On restaure après.
    link_p0_backup = _backup_link_flows(network)

    # Sauvegarder le dispatch LOPF : lpf()/pf() redistribuent le slack et
    # écrasent generators_t.p — on restaure pour conserver le dispatch optimal.
    gen_p_backup = _backup_gen_dispatch(network)

    def _restore_and_return(status: str) -> str:
        _restore_link_flows(network, link_p0_backup)
        _restore_gen_dispatch(network, gen_p_backup)
        return status

    # LPF direct si mode DC ou contraintes relâchées (opérating point non-physique)
    if mode == "dc" or was_relaxed:
        try:
            network.lpf()
            return _restore_and_return("lpf_done" if not was_relaxed else "lpf_done_relaxed")
        except Exception as exc:
            logger.warning("LPF échoué : %s", exc)
            return _restore_and_return("lpf_failed")

    # Détecter les bus isolés connectés uniquement via Links (ex: nœuds Etranger).
    # Ces bus créent des composantes déconnectées dans la matrice Y AC → Newton-Raphson
    # diverge systématiquement. On exécute le PF sur le réseau interne uniquement.
    if len(network.links) > 0:
        buses_in_lines = set(network.lines["bus0"]) | set(network.lines["bus1"])
        link_only_buses = [
            b for b in network.buses.index
            if b not in buses_in_lines
            and (
                (network.links["bus0"] == b).any()
                or (network.links["bus1"] == b).any()
            )
        ]
        if link_only_buses:
            logger.info(
                "AC PF interne : %d bus isolés détectés — PF sur réseau interne uniquement",
                len(link_only_buses),
            )
            try:
                status = _run_internal_ac_pf(network)
                return _restore_and_return(status)
            except Exception as exc:
                logger.warning(
                    "AC PF interne échoué (%s), fallback LPF", str(exc)[:120]
                )
                try:
                    network.lpf()
                    return _restore_and_return("lpf_fallback")
                except Exception as exc2:
                    logger.error("LPF fallback échoué : %s", exc2)
                    _restore_link_flows(network, link_p0_backup)
                    _restore_gen_dispatch(network, gen_p_backup)
                    return "flow_failed"

    # mode == "ac" — propager le dispatch comme consigne
    if "p" in network.generators_t and not network.generators_t.p.empty:
        network.generators_t.p_set = network.generators_t.p.copy()

    try:
        network.pf(x_tol=1e-5)
        return _restore_and_return("pf_done")
    except Exception as exc:
        err_msg = str(exc)
        if "singular" in err_msg.lower() or "converge" in err_msg.lower():
            logger.warning("AC PF non-convergent (singularité ou tolérance), fallback LPF")
        else:
            logger.warning("AC PF échoué (%s), fallback LPF", err_msg[:120])
        try:
            network.lpf()
            return _restore_and_return("lpf_fallback")
        except Exception as exc2:
            logger.error("LPF fallback échoué : %s", exc2)
            _restore_link_flows(network, link_p0_backup)
            _restore_gen_dispatch(network, gen_p_backup)
            return "flow_failed"


def _backup_link_flows(network: pypsa.Network) -> Optional[pd.DataFrame]:
    """Sauvegarde links_t.p0 avant le PF (LPF/AC peut l'écraser)."""
    if hasattr(network, "links_t") and "p0" in network.links_t and not network.links_t.p0.empty:
        return network.links_t.p0.copy()
    return None


def _restore_link_flows(network: pypsa.Network, backup: Optional[pd.DataFrame]) -> None:
    """Restaure links_t.p0 depuis la sauvegarde OPF."""
    if backup is not None:
        network.links_t["p0"] = backup


def _backup_gen_dispatch(network: pypsa.Network) -> Optional[pd.DataFrame]:
    """Sauvegarde generators_t.p avant le PF (lpf/pf redistribue le slack et écrase le dispatch LOPF)."""
    if hasattr(network, "generators_t") and "p" in network.generators_t and not network.generators_t.p.empty:
        return network.generators_t.p.copy()
    return None


def _restore_gen_dispatch(network: pypsa.Network, backup: Optional[pd.DataFrame]) -> None:
    """Restaure generators_t.p depuis la sauvegarde LOPF.

    Raison : lpf() / pf() redistribuent la puissance de réglage primaire (slack)
    sur les générateurs et écrasent le dispatch LOPF optimal.  En restaurant ici,
    extract_kpis() peut lire la production par carrier correctement.
    """
    if backup is not None:
        network.generators_t["p"] = backup


def _run_internal_ac_pf(network: pypsa.Network) -> str:
    """AC Newton-Raphson PF sur le réseau interne HQ uniquement.

    Les buses Étranger (connectés uniquement via Links) sont exclus pour éviter
    la singularité de la matrice Y.  Les flux Links de l'LOPF sont convertis en
    charges/injections fixes aux buses Interco frontière avant d'exclure les
    buses Étranger, afin de conserver l'équilibre KCL aux nœuds de frontière.

    Convention de signe pour les corrections de charge :
        p0 > 0  (export Interco → Étranger) → Load +p0  au bus Interco (consomme)
        p0 < 0  (import Étranger → Interco) → Load +p0  au bus Interco (injecte, car p0<0)

    En résumé : Load.p_set = +p0  dans les deux cas (bus Interco = bus0 du Link).
    Si la topologie était inversée (Étranger = bus0), Load.p_set = -p0.

    Retourne "pf_internal_done" en cas de succès ; lève une exception sinon.
    """
    # Flux Links issus de l'LOPF
    link_flows: pd.DataFrame = (
        network.links_t.p0.copy()
        if "p0" in network.links_t and not network.links_t.p0.empty
        else pd.DataFrame(index=network.snapshots)
    )

    # Identifier les buses Étranger (aucune ligne AC, uniquement des Links)
    buses_with_lines: set = set(network.lines["bus0"]) | set(network.lines["bus1"])
    etranger_buses: set = {b for b in network.buses.index if b not in buses_with_lines}

    if not etranger_buses:
        # Pas de buses isolés — PF standard
        if "p" in network.generators_t and not network.generators_t.p.empty:
            network.generators_t.p_set = network.generators_t.p.copy()
        network.pf(x_tol=1e-5)
        return "pf_done"

    # === Copie du réseau pour le PF interne ===
    # Après optimize(), PyPSA attache un modèle linopy qui ne peut pas être copié.
    # On le supprime avant copy() — il n'est plus nécessaire pour le PF.
    if hasattr(network, "model") and network.model is not None:
        del network.model
    net_int = network.copy()

    # --- Corrections de charge aux buses Interco ---
    # Quand on supprime un Link, le bus Interco perd son terme de bilan lié au Link.
    # On le compense par une charge temporaire dont p_set = +p0 (bus0=Interco)
    # ou p_set = -p0 (bus1=Interco).
    link_corrections: dict = {}
    for link_name in network.links.index:
        if link_name not in link_flows.columns:
            continue
        bus0 = str(network.links.at[link_name, "bus0"])
        bus1 = str(network.links.at[link_name, "bus1"])
        p0 = link_flows[link_name]
        zero = pd.Series(0.0, index=network.snapshots)

        if bus0 not in etranger_buses and bus1 in etranger_buses:
            # Interco = bus0 → export/import sort par bus0 → Load = +p0
            link_corrections[bus0] = link_corrections.get(bus0, zero.copy()) + p0
        elif bus0 in etranger_buses and bus1 not in etranger_buses:
            # Interco = bus1 → puissance arrive par bus1 → Load = -p0
            link_corrections[bus1] = link_corrections.get(bus1, zero.copy()) - p0

    # Ajouter les charges de correction dans la copie
    for bus_name, correction in link_corrections.items():
        tmp_name = f"_lnk_{bus_name}"
        net_int.add("Load", tmp_name, bus=bus_name, p_set=0.0)
        net_int.loads_t.p_set[tmp_name] = correction.values

    # --- Supprimer les composantes Étranger de la copie ---
    market_gens = [g for g in net_int.generators.index if g.startswith("market_")]
    all_links = list(net_int.links.index)
    if market_gens:
        net_int.remove("Generator", market_gens)
    if all_links:
        net_int.remove("Link", all_links)
    for eb in list(etranger_buses):
        if eb in net_int.buses.index:
            net_int.remove("Bus", eb)

    # --- Fixer le dispatch générateurs depuis l'LOPF ---
    # On utilise network.generators_t.p (original) car copy() ne préserve pas
    # les DataFrames de résultats de l'optimisation (ils ne font pas partie des entrées).
    if "p" in network.generators_t and not network.generators_t.p.empty:
        valid_cols = [c for c in network.generators_t.p.columns if c in net_int.generators.index]
        if valid_cols:
            net_int.generators_t.p_set = network.generators_t.p[valid_cols].copy()

    # --- Contrôle de tension : passer les générateurs en PV ---
    # Sans bus PV, Newton-Raphson diverge souvent sur un grand réseau (pas de support Q).
    # Les grands générateurs hydro contrôlent réalistement leur tension à ≈1.0 pu.
    # Les charges de correction (_lnk_*) restent en PQ (injections fixes).
    real_gens = [g for g in net_int.generators.index if not g.startswith("_lnk_")]
    if real_gens:
        net_int.generators.loc[real_gens, "control"] = "PV"

    # --- AC Newton-Raphson sur le réseau interne ---
    net_int.pf(x_tol=1e-5, distribute_slack=True)

    # --- Vérifier la convergence ---
    # PyPSA 0.26+ émet un warning mais ne lève pas d'exception en cas de divergence.
    # On vérifie via les tensions : NaN ou hors [0.5, 1.5] pu signale une non-convergence.
    if "v_mag_pu" in net_int.buses_t and not net_int.buses_t.v_mag_pu.empty:
        v = net_int.buses_t.v_mag_pu
        bad_mask = v.isnull() | (v < 0.5) | (v > 1.5)
        n_bad_snapshots = bad_mask.any(axis=1).sum()
        if n_bad_snapshots > 0:
            raise RuntimeError(
                f"AC PF interne non-convergé pour {n_bad_snapshots}/"
                f"{len(net_int.snapshots)} snapshots (tensions hors [0.5, 1.5] pu)"
            )

    # --- Reporter les flux de lignes dans le réseau original ---
    if "p0" in net_int.lines_t and not net_int.lines_t.p0.empty:
        network.lines_t["p0"] = net_int.lines_t["p0"].copy()
    if "p1" in net_int.lines_t and not net_int.lines_t.p1.empty:
        network.lines_t["p1"] = net_int.lines_t["p1"].copy()

    logger.info(
        "AC PF interne convergé — pertes exactes I²R disponibles (%d lignes)",
        len(net_int.lines_t.p0.columns) if "p0" in net_int.lines_t else 0,
    )
    return "pf_internal_done"


# ---------------------------------------------------------------------------
# Violations thermiques
# ---------------------------------------------------------------------------

def _build_constraint_warnings(
    network: pypsa.Network,
    original_snoms: Optional[pd.Series],
) -> List[Dict[str, Any]]:
    """Construit la liste des lignes surchargées.

    Si original_snoms est fourni (après relâchement), compare les flux
    aux s_nom originaux pour détecter toutes les surcharges.
    Sinon, compare aux s_nom courants.
    """
    if not hasattr(network, "lines_t") or "p0" not in network.lines_t:
        return []

    p0 = network.lines_t["p0"]
    if p0.empty:
        return []

    max_flow = p0.abs().max()
    snoms_ref = original_snoms if original_snoms is not None else network.lines.get("s_nom")
    if snoms_ref is None:
        return []

    warnings = []
    for line_name, flow in max_flow.items():
        if line_name not in snoms_ref.index:
            continue
        s_nom = float(snoms_ref[line_name])
        if s_nom <= 0 or s_nom >= _RELAX_SNOM:
            continue
        loading = float(flow / s_nom * 100.0)
        if loading > 100.0:
            warnings.append({
                "line":              line_name,
                "original_s_nom_mva": s_nom,
                "actual_flow_mw":    float(flow),
                "overload_percent":  round(loading, 1),
                "suggestion":        _upgrade_suggestion(s_nom, loading),
            })

    # Trier par surcharge décroissante
    warnings.sort(key=lambda w: w["overload_percent"], reverse=True)
    return warnings


def _build_link_warnings(network: pypsa.Network) -> List[Dict[str, Any]]:
    """Flagge les interconnexions dont le flux dépasse la capacité contractuelle.

    Détecte deux situations :
    - Export dépassant p_max_pu * p_nom (capacity relâchée après fallback)
    - Import dépassant |p_min_pu| * p_nom
    Seuls les Links connectant un bus Interco à un bus Étranger sont vérifiés.
    """
    if not hasattr(network, "links_t") or "p0" not in network.links_t:
        return []
    p0_links = network.links_t["p0"]
    if p0_links.empty or len(network.links) == 0:
        return []

    warnings = []
    for link_name in p0_links.columns:
        if link_name not in network.links.index:
            continue
        lk = network.links.loc[link_name]
        bus0, bus1 = str(lk.get("bus0", "")), str(lk.get("bus1", ""))
        # N'inspecter que les liens Interco↔Étranger
        is_interco = (
            (bus0.startswith("Interco") and bus1.startswith("Etranger"))
            or (bus1.startswith("Interco") and bus0.startswith("Etranger"))
        )
        if not is_interco:
            continue

        p_nom = float(lk.get("p_nom", 0.0))
        p_max_pu_orig = float(lk.get("p_max_pu", 1.0))
        p_min_pu_orig = float(lk.get("p_min_pu", -1.0))
        export_cap = p_nom * p_max_pu_orig
        import_cap = p_nom * abs(p_min_pu_orig)

        series = p0_links[link_name]
        max_export = float(series.max())   # p0 > 0
        max_import = float(series.min())   # p0 < 0 (most negative = most import)

        if export_cap > 0 and max_export > export_cap * 1.001:
            pct = max_export / export_cap * 100.0
            warnings.append({
                "link":              link_name,
                "type":              "export_exceeded",
                "capacity_mw":       round(export_cap, 1),
                "actual_flow_mw":    round(max_export, 1),
                "overload_percent":  round(pct, 1),
                "suggestion": (
                    f"Export dépasse la capacité contractuelle ({export_cap:.0f} MW) "
                    f"à {pct:.0f}% — envisager augmentation du contrat d'export"
                ),
            })
        if import_cap > 0 and abs(max_import) > import_cap * 1.001:
            pct = abs(max_import) / import_cap * 100.0
            warnings.append({
                "link":              link_name,
                "type":              "import_exceeded",
                "capacity_mw":       round(import_cap, 1),
                "actual_flow_mw":    round(abs(max_import), 1),
                "overload_percent":  round(pct, 1),
                "suggestion": (
                    f"Import dépasse la capacité contractuelle ({import_cap:.0f} MW) "
                    f"à {pct:.0f}% — envisager augmentation du contrat d'import"
                ),
            })

    warnings.sort(key=lambda w: w["overload_percent"], reverse=True)
    return warnings


def _upgrade_suggestion(s_nom_mva: float, loading_pct: float) -> str:
    """Génère une suggestion d'upgrade basée sur la surcharge."""
    if s_nom_mva <= 200:
        next_level = "230kV"
    elif s_nom_mva <= 400:
        next_level = "315kV"
    elif s_nom_mva <= 600:
        next_level = "735kV"
    else:
        next_level = "circuit additionnel"
    return (
        f"Ligne surchargée à {loading_pct:.0f}% — "
        f"considérer upgrade vers {next_level} ou ajout d'un circuit parallèle"
    )
