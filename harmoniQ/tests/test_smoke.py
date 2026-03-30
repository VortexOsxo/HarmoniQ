"""Tests unitaires de base — s'exécutent en CI sans DB ni connexion réseau."""

import importlib


def test_harmoniq_importable():
    """Le package harmoniq doit s'importer sans erreur."""
    mod = importlib.import_module("harmoniq")
    assert mod is not None


def test_water_value_cost():
    """water_value_cost : calibration de base."""
    import numpy as np
    from harmoniq.modules.reseau_bis.utils.reservoir_tracker import water_value_cost

    costs = water_value_cost(np.array([0.0, 0.25, 1.0]))
    # Réservoir vide → coût élevé (exponentiel) ; réservoir plein → coût minimal
    assert costs[0] > costs[1] > costs[2], "Coût doit décroître avec le niveau"
    assert costs[2] == 5.0, "Réservoir plein → coût minimal 5 $/MWh"


def test_results_totale_excludes_market():
    """results._build_production_df doit exclure les générateurs import/export du total."""
    import pandas as pd
    import pypsa

    n = pypsa.Network()
    n.set_snapshots(pd.date_range("2035-01-01", periods=3, freq="h"))
    n.add("Bus", "bus0", v_nom=735.0)
    n.add("Generator", "hydro", bus="bus0", p_nom=100.0, carrier="hydro_reservoir", marginal_cost=10.0)
    n.add("Generator", "import_ON", bus="bus0", p_nom=200.0, carrier="import", marginal_cost=15.0)

    # Simuler un dispatch
    n.generators_t["p"] = pd.DataFrame(
        {"hydro": [80.0, 90.0, 70.0], "import_ON": [20.0, 10.0, 30.0]},
        index=n.snapshots,
    )

    prod_mask = ~n.generators.carrier.isin(["import", "export"])
    prod_gens = n.generators.index[prod_mask]
    totale = n.generators_t["p"].reindex(columns=prod_gens, fill_value=0.0).sum(axis=1)

    # totale ne doit compter que hydro, pas import_ON
    assert list(totale) == [80.0, 90.0, 70.0], f"totale inattendu : {list(totale)}"


def test_pypsa_optimize_non_zero():
    """Régression pandas 3.0 / PyPSA 1.x : ArrowStringArray crashait l'OPF.

    Sans le patch string_storage='python' dans harmoniq/__init__.py,
    network.optimize() lève TypeError et tous les chunks retournent 0 MW.
    Ce test s'assure que la simulation produit un résultat non-nul.
    """
    import harmoniq  # noqa: F401 — déclenche le patch pandas
    import pandas as pd
    import pypsa

    n = pypsa.Network()
    sns = pd.date_range("2035-01-07", periods=2, freq="7D")
    n.set_snapshots(sns)
    n.add("Bus", "bus0", v_nom=735.0)
    n.add("Generator", "hydro", bus="bus0", p_nom=1000.0, carrier="hydro_reservoir",
          p_min_pu=0.10, p_max_pu=0.95, marginal_cost=10.0)
    n.add("Load", "load0", bus="bus0", p_set=500.0)

    status, condition = n.optimize(sns, solver_name="highs")
    assert status == "ok", f"OPF non-optimal : status={status}, condition={condition}"
    dispatch = n.generators_t.p["hydro"]
    assert (dispatch > 0).all(), f"Dispatch hydro = 0 (régresssion pandas/PyPSA) : {dispatch.values}"
