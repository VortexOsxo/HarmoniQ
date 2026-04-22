"""Tests for the PyPSA-using methods of EnergyUtils not covered by test_energy_utils.py."""
import pytest
import pypsa
import pandas as pd
import numpy as np

from harmoniq.modules.reseau.utils.energy_utils import EnergyUtils


# ── Fixture helpers ───────────────────────────────────────────────────────────

def _make_network(n_hours: int = 4, include_stanstead: bool = False) -> pypsa.Network:
    idx = pd.date_range("2024-01-01", periods=n_hours, freq="h")
    n = pypsa.Network()
    n.set_snapshots(idx)

    n.add("Bus", "busA")
    n.add("Bus", "busB")
    n.add("Line", "line1", bus0="busA", bus1="busB", x=0.1, r=0.01, s_nom=500.0)

    n.add("Generator", "gen_eolien",    bus="busA", p_nom=200.0, carrier="eolien",         marginal_cost=0.1)
    n.add("Generator", "gen_reservoir", bus="busA", p_nom=500.0, carrier="hydro_reservoir", marginal_cost=7.0)
    n.add("Generator", "gen_thermique", bus="busB", p_nom=300.0, carrier="thermique",       marginal_cost=30.0)

    n.add("Load", "load1", bus="busA")
    n.add("Load", "load2", bus="busB")

    rng = np.random.default_rng(0)
    n.loads_t.p_set["load1"] = pd.Series(rng.uniform(100, 160, n_hours), index=idx)
    n.loads_t.p_set["load2"] = pd.Series(rng.uniform(80, 120, n_hours), index=idx)
    n.generators_t.p_max_pu["gen_eolien"] = pd.Series(rng.uniform(0.5, 1.0, n_hours), index=idx)
    n.generators_t.marginal_cost["gen_reservoir"] = pd.Series(np.full(n_hours, 7.0), index=idx)

    if include_stanstead:
        n.add("Bus", "Stanstead")

    return n


def _optimized_network(n_hours: int = 3) -> pypsa.Network:
    from harmoniq.modules.reseau.core.optimization import NetworkOptimizer
    n = _make_network(n_hours)
    NetworkOptimizer(n).optimize_manually()
    return n


# ── obtenir_bus_frontiere ─────────────────────────────────────────────────────

class TestObtenirBusFrontiere:
    def test_returns_stanstead_when_present(self):
        n = _make_network(include_stanstead=True)
        result = EnergyUtils.obtenir_bus_frontiere(n, "Interconnexion")
        assert result == "Stanstead"

    def test_returns_first_bus_when_stanstead_absent(self):
        n = _make_network(include_stanstead=False)
        result = EnergyUtils.obtenir_bus_frontiere(n, "Interconnexion")
        assert result in n.buses.index

    def test_returns_string(self):
        n = _make_network()
        assert isinstance(EnergyUtils.obtenir_bus_frontiere(n, "any"), str)


# ── identifier_nouvelles_centrales ────────────────────────────────────────────

class TestIdentifierNouvellesCentrales:
    def test_returns_empty_list(self):
        n = _make_network()
        assert EnergyUtils.identifier_nouvelles_centrales(n) == []


# ── ajouter_interconnexion_import_export ─────────────────────────────────────

class TestAjouterInterconnexion:
    def test_positive_pmax_adds_generator(self):
        n = _make_network(include_stanstead=True)
        before = len(n.generators)
        EnergyUtils.ajouter_interconnexion_import_export(n, Pmax=500, bus_frontiere="Stanstead")
        assert len(n.generators) == before + 1

    def test_added_generator_is_import_carrier(self):
        n = _make_network(include_stanstead=True)
        EnergyUtils.ajouter_interconnexion_import_export(n, Pmax=500, bus_frontiere="Stanstead")
        import_gens = n.generators[n.generators.carrier == "import"]
        assert len(import_gens) > 0

    def test_unknown_bus_returns_network_unchanged(self):
        n = _make_network()
        before = len(n.generators)
        EnergyUtils.ajouter_interconnexion_import_export(n, Pmax=100, bus_frontiere="NonExistent")
        assert len(n.generators) == before

    def test_returns_network(self):
        n = _make_network(include_stanstead=True)
        result = EnergyUtils.ajouter_interconnexion_import_export(n, Pmax=100, bus_frontiere="Stanstead")
        assert isinstance(result, pypsa.Network)


# ── reechantillonner_reseau_journalier ────────────────────────────────────────

class TestReechantillonnerJournalier:
    def test_returns_network(self):
        n = _make_network(n_hours=48)
        result = EnergyUtils.reechantillonner_reseau_journalier(n)
        assert isinstance(result, pypsa.Network)

    def test_daily_snapshots_fewer_than_hourly(self):
        n = _make_network(n_hours=48)
        result = EnergyUtils.reechantillonner_reseau_journalier(n)
        assert len(result.snapshots) < len(n.snapshots)

    def test_single_snapshot_returns_same(self):
        idx = pd.date_range("2024-01-01", periods=1, freq="h")
        n = pypsa.Network()
        n.set_snapshots(idx)
        n.add("Bus", "b1")
        result = EnergyUtils.reechantillonner_reseau_journalier(n)
        assert isinstance(result, pypsa.Network)


# ── align_time_indexes ────────────────────────────────────────────────────────

class TestAlignTimeIndexes:
    def test_no_error_on_aligned_network(self):
        n = _make_network()
        EnergyUtils.align_time_indexes(n)  # should not raise

    def test_no_error_on_empty_snapshots(self):
        n = pypsa.Network()
        EnergyUtils.align_time_indexes(n)  # should not raise

    def test_misaligned_generators_t_gets_reindexed(self):
        idx1 = pd.date_range("2024-01-01", periods=4, freq="h")
        idx2 = pd.date_range("2024-01-01", periods=2, freq="h")
        n = pypsa.Network()
        n.set_snapshots(idx1)
        n.add("Bus", "b1")
        n.add("Generator", "g1", bus="b1", p_nom=100, carrier="eolien", marginal_cost=0.1)
        # Assign shorter index directly to bypass PyPSA alignment
        n.generators_t.p_max_pu = pd.DataFrame({"g1": [0.8, 0.9]}, index=idx2)
        EnergyUtils.align_time_indexes(n)
        assert len(n.generators_t.p_max_pu) == len(idx1)


# ── ensure_network_solvability ────────────────────────────────────────────────

class TestEnsureNetworkSolvability:
    def test_returns_network(self):
        n = _make_network()
        result = EnergyUtils.ensure_network_solvability(n)
        assert isinstance(result, pypsa.Network)

    def test_sets_p_nom_extendable(self):
        n = _make_network()
        EnergyUtils.ensure_network_solvability(n)
        assert n.generators.p_nom_extendable.all()

    def test_disconnected_components_get_virtual_lines(self):
        # Two isolated buses with no line between them
        idx = pd.date_range("2024-01-01", periods=2, freq="h")
        n = pypsa.Network()
        n.set_snapshots(idx)
        n.add("Bus", "bus1")
        n.add("Bus", "bus2")
        n.add("Generator", "g1", bus="bus1", p_nom=500.0, carrier="eolien", marginal_cost=0.1)
        n.add("Load", "l1", bus="bus2")
        n.loads_t.p_set["l1"] = pd.Series([100.0, 120.0], index=idx)
        before_lines = len(n.lines)
        EnergyUtils.ensure_network_solvability(n)
        assert len(n.lines) > before_lines


# ── debug_network_energy_allocation ──────────────────────────────────────────

class TestDebugNetworkEnergyAllocation:
    def test_runs_without_error(self):
        n = _optimized_network()
        EnergyUtils.debug_network_energy_allocation(n)  # main value: no exception

    def test_daily_mode_runs_without_error(self):
        n = _optimized_network()
        EnergyUtils.debug_network_energy_allocation(n, is_journalier=True)

    def test_hourly_period_runs_without_error(self):
        n = _optimized_network()
        EnergyUtils.debug_network_energy_allocation(n, period="hourly")
