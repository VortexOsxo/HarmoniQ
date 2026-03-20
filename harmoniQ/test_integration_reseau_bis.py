#!/usr/bin/env python
"""
Test d'intégration RÉEL — reseau_bis avec tous les modules connectés.

Utilise :
  - Scénario 2035 complet (8760h, année entière) depuis la DB
  - ListeInfrastructures #1 (toutes les infras)
  - Vrais profils : InfraParcEolienne, InfraSolaire, InfraHydro, InfraThermique
  - Vraie demande depuis demande.db (99 MRC)
  - LOPF HiGHS + AC PF Newton-Raphson interne

Usage:
    python test_integration_reseau_bis.py [--scenario_id 1] [--flow_mode ac]
"""

import argparse
import io
import logging
import sys
import time

import pandas as pd

# Pandas 3.0 compat
pd.options.mode.string_storage = "python"
try:
    pd.options.future.infer_string = False
except AttributeError:
    pass

# Windows cp1252 ne peut pas encoder les emoji (ex : 🌍) de l'API open-meteo.
# Reconfigurer stdout/stderr en UTF-8 (errors='replace') avant d'importer les
# modules météo pour éviter UnicodeEncodeError dans InfraParcEolienne.
for _name in ("stdout", "stderr"):
    _s = getattr(sys, _name, None)
    if (
        _s is not None
        and hasattr(_s, "buffer")
        and getattr(_s, "encoding", "utf-8").lower() not in ("utf-8", "utf_8", "utf8")
    ):
        try:
            setattr(
                sys, _name,
                io.TextIOWrapper(
                    _s.buffer,
                    encoding="utf-8",
                    errors="replace",
                    line_buffering=getattr(_s, "line_buffering", False),
                )
            )
        except Exception:
            pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("test_integration")

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
parser = argparse.ArgumentParser(description="Test intégration reseau_bis")
parser.add_argument("--scenario_id", type=int, default=1, help="ID du scénario (1=2035, 2=2050)")
parser.add_argument("--liste_infra_id", type=int, default=1, help="ID de la liste d'infras")
parser.add_argument("--flow_mode", type=str, default="ac", choices=["ac", "dc", "dc+ac"],
                    help="Mode de flux de puissance")
args = parser.parse_args()

# ---------------------------------------------------------------------------
# Chargement depuis la vraie DB
# ---------------------------------------------------------------------------
log.info("=" * 70)
log.info("TEST INTÉGRATION reseau_bis — Scénario #%d, flow_mode=%s", args.scenario_id, args.flow_mode)
log.info("=" * 70)

from harmoniq.db.schemas import Scenario, ListeInfrastructures
from harmoniq.db.engine import get_db

db = next(get_db())

scenario = db.query(Scenario).filter(Scenario.id == args.scenario_id).first()
if scenario is None:
    log.error("Scénario #%d introuvable dans la DB", args.scenario_id)
    sys.exit(1)

liste_infra = db.query(ListeInfrastructures).filter(
    ListeInfrastructures.id == args.liste_infra_id
).first()
if liste_infra is None:
    log.error("ListeInfrastructures #%d introuvable dans la DB", args.liste_infra_id)
    sys.exit(1)

log.info("  Scénario    : %s (%s → %s)", scenario.nom, scenario.date_de_debut, scenario.date_de_fin)
log.info("  Pas de temps: %s", scenario.pas_de_temps)
log.info("  Météo       : %s | Conso : %s", scenario.weather, scenario.consomation)
log.info("  Liste infra : %s (id=%d)", liste_infra.nom, liste_infra.id)

n_eol = len((liste_infra.parc_eoliens or "").split(",")) if liste_infra.parc_eoliens else 0
n_hyd = len((liste_infra.central_hydroelectriques or "").split(",")) if liste_infra.central_hydroelectriques else 0
n_sol = len((liste_infra.parc_solaires or "").split(",")) if liste_infra.parc_solaires else 0
n_thm = len((liste_infra.central_thermique or "").split(",")) if liste_infra.central_thermique else 0
n_nuc = len((liste_infra.central_nucleaire or "").split(",")) if liste_infra.central_nucleaire else 0
log.info("  Infras      : %d éolien | %d hydro | %d solaire | %d thermique | %d nucléaire",
         n_eol, n_hyd, n_sol, n_thm, n_nuc)

# ---------------------------------------------------------------------------
# Exécution via InfraReseauBis (exactement comme REST.py le ferait)
# ---------------------------------------------------------------------------
from harmoniq.modules.reseau_bis.service import InfraReseauBis

log.info("")
log.info("=" * 70)
log.info("1. Création du réseau PyPSA (data_loader + network_builder)")
log.info("=" * 70)

t_total = time.time()

infra = InfraReseauBis(liste_infra)
infra.charger_scenario(scenario)

t0 = time.time()
network = infra.creer_reseau(db)
t_build = time.time() - t0

log.info("  Réseau créé en %.1fs", t_build)
log.info("  Buses=%d | Lines=%d | Links=%d | Generators=%d | Loads=%d",
         len(network.buses), len(network.lines), len(network.links),
         len(network.generators), len(network.loads))

# === DIAGNOSTIC CARRIERS ===
if len(network.generators) > 0:
    log.info("  --- Générateurs par carrier ---")
    for carrier, count in network.generators.carrier.value_counts().items():
        gens_c = network.generators[network.generators.carrier == carrier]
        total_pnom = gens_c["p_nom"].sum()
        log.info("    %-20s : %3d gén  p_nom_total=%7.0f MW", carrier, count, total_pnom)
    # Détecter les générateurs sans bus valide
    invalid_bus = network.generators[~network.generators.bus.isin(network.buses.index)]
    if len(invalid_bus) > 0:
        log.warning("  ATTENTION : %d générateurs sur bus invalide !", len(invalid_bus))
        for name, row in invalid_bus.head(5).iterrows():
            log.warning("    %s [%s] → bus='%s' introuvable", name, row.get("carrier","?"), row.get("bus","?"))
log.info("  Snapshots: %d (%s → %s)",
         len(network.snapshots), network.snapshots[0], network.snapshots[-1])

# Vérifier les profils de génération
pmax = network.generators_t.p_max_pu
if not pmax.empty:
    varying = [c for c in pmax.columns if pmax[c].std() > 0.01]
    constant = [c for c in pmax.columns if pmax[c].std() <= 0.01]
    log.info("  p_max_pu: %d générateurs avec profils VARIABLES (vrais modules)", len(varying))
    log.info("  p_max_pu: %d générateurs avec profils CONSTANTS (fallback)", len(constant))
    if varying:
        for v in varying[:5]:
            carrier = network.generators.at[v, "carrier"] if v in network.generators.index else "?"
            log.info("    %-30s [%s] min=%.3f max=%.3f", v, carrier, pmax[v].min(), pmax[v].max())
        if len(varying) > 5:
            log.info("    ... (%d supplémentaires)", len(varying) - 5)

# Coûts marginaux
mcost = network.generators_t.marginal_cost
if not mcost.empty:
    log.info("  Coûts marginaux: %d colonnes", len(mcost.columns))
    for carrier in network.generators.carrier.unique():
        gens = network.generators.index[network.generators.carrier == carrier]
        vals = mcost.reindex(columns=gens, fill_value=0.0)
        if not vals.empty:
            log.info("    %-20s : min=%.1f max=%.1f $/MWh", carrier, vals.min().min(), vals.max().max())

# Demande
demand = network.loads_t.p_set
if not demand.empty:
    total_demand = demand.sum(axis=1)
    log.info("  Demande: %d bus Conso | min=%.0f MW | max=%.0f MW | moy=%.0f MW",
             len(demand.columns), total_demand.min(), total_demand.max(), total_demand.mean())
    log.info("  Demande annuelle totale: %.0f GWh", total_demand.sum() / 1000)

# ---------------------------------------------------------------------------
# 2. Dispatch + Power Flow
# ---------------------------------------------------------------------------
log.info("")
log.info("=" * 70)
log.info("2. Dispatch LOPF + AC PF (mode=%s)", args.flow_mode)
log.info("=" * 70)

t1 = time.time()
result = infra.calculer_production(db=db, is_journalier=False, flow_mode=args.flow_mode)
t_calc = time.time() - t1

log.info("  Calcul terminé en %.1fs", t_calc)

# === DIAGNOSTIC DISPATCH POST-SOLVE ===
if "p" in infra.network.generators_t and not infra.network.generators_t.p.empty:
    p_solved = infra.network.generators_t.p
    log.info("  --- Dispatch par carrier (GWh) ---")
    for carrier in infra.network.generators.carrier.unique():
        gens_c = infra.network.generators.index[infra.network.generators.carrier == carrier]
        dispatch_c = p_solved.reindex(columns=gens_c, fill_value=0.0).sum().sum() / 1000
        log.info("    %-20s : %8.0f GWh", carrier, dispatch_c)
    log.info("  --- Top 15 générateurs dispatché (GWh) ---")
    dispatch_total = p_solved.sum().sort_values(ascending=False)
    for gen_name, mwh in dispatch_total.head(15).items():
        carrier = infra.network.generators.at[gen_name, "carrier"] if gen_name in infra.network.generators.index else "?"
        log.info("    %-40s [%-18s]: %8.0f GWh", gen_name, carrier, mwh / 1000)
else:
    log.warning("  generators_t.p vide après solve !")

# ---------------------------------------------------------------------------
# 3. Résultats
# ---------------------------------------------------------------------------
log.info("")
log.info("=" * 70)
log.info("3. Résultats")
log.info("=" * 70)

summary = result.get("summary", {})
production = result.get("production", [])

log.info("--- KPIs globaux ---")
log.info("  Énergie totale      : %.0f GWh", summary.get("total_energy_mwh", 0) / 1000)
log.info("  Pertes réseau       : %.0f MWh (%.2f%%)",
         summary.get("total_losses_mwh", 0), summary.get("losses_percent", 0))
log.info("  Violations thermiques: %d lignes", summary.get("n_violations", 0))
log.info("  Contraintes relâchées: %s (n=%d)",
         result.get("was_relaxed", False), summary.get("n_constraint_warnings", 0))
log.info("  Import total        : %.0f GWh", summary.get("total_import_mwh", 0) / 1000)
log.info("  Export total        : %.0f GWh", summary.get("total_export_mwh", 0) / 1000)

# Production par carrier (depuis les records production)
log.info("")
log.info("--- Production par carrier (GWh annuel) ---")
if production:
    df = pd.DataFrame(production)
    carrier_cols = [c for c in df.columns if c.startswith("total_")]
    for col in sorted(carrier_cols):
        gwh = df[col].sum() / 1000
        if gwh > 0.01:
            log.info("  %-25s : %10.1f GWh", col.replace("total_", ""), gwh)
    if "totale" in df.columns:
        log.info("  %-25s : %10.1f GWh", "TOTAL", df["totale"].sum() / 1000)

# Violations top 10
violations = result.get("violations", [])
if violations:
    log.info("")
    log.info("--- Top 10 violations thermiques ---")
    for v in violations[:10]:
        log.info("  %-40s : %.1f%% (%.0f / %.0f MVA)",
                 v.get("line", "?"), v.get("loading_percent", 0),
                 v.get("max_flow_mw", 0), v.get("s_nom_mva", 0))

# Interconnexions
link_flows = result.get("link_flows", [])
if link_flows:
    log.info("")
    log.info("--- Flux interconnexions (GWh annuel) ---")
    for lf in link_flows:
        exp = lf.get("total_export_mwh", 0) / 1000
        imp = lf.get("total_import_mwh", 0) / 1000
        if exp > 0.01 or imp > 0.01:
            log.info("  %-45s : export=%7.1f GWh  import=%7.1f GWh",
                     lf.get("link", "?"), exp, imp)

# Timers
log.info("")
log.info("--- Timers ---")
total_time = time.time() - t_total
if hasattr(infra, "timers"):
    for k, v in sorted(infra.timers.items()):
        log.info("  %-30s : %.1fs", k, v)
log.info("  %-30s : %.1fs", "TOTAL (incluant ce script)", total_time)

# Validation
log.info("")
log.info("=" * 70)
if summary.get("total_energy_mwh", 0) > 0 and len(production) > 100:
    log.info("✅ TEST INTÉGRATION RÉUSSI — %d snapshots, %.0f GWh, pertes %.2f%%",
             len(production), summary.get("total_energy_mwh", 0) / 1000,
             summary.get("losses_percent", 0))
else:
    log.error("❌ TEST INTÉGRATION ÉCHOUÉ — production vide ou insuffisante")
    sys.exit(1)
log.info("=" * 70)

db.close()
