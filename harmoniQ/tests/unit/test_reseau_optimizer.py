"""Tests for NetworkOptimizer and TimeSeriesManager using real PyPSA networks.
No mocking of PyPSA — just build small networks directly.
"""
import pytest
import pypsa
import pandas as pd
import numpy as np

from harmoniq.modules.reseau.core.optimization import NetworkOptimizer
from harmoniq.modules.reseau.utils.time_utils import TimeSeriesManager


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_network(n_hours: int = 4) -> pypsa.Network:
    """Minimal network: 2 buses, 3 generators (eolien/reservoir/thermique), 2 loads."""
    idx = pd.date_range("2024-01-01", periods=n_hours, freq="h")
    n = pypsa.Network()
    n.set_snapshots(idx)

    n.add("Bus", "busA")
    n.add("Bus", "busB")
    n.add("Line", "line1", bus0="busA", bus1="busB", x=0.1, r=0.01, s_nom=500.0)

    n.add("Generator", "gen_eolien",    bus="busA", p_nom=200.0, carrier="eolien",          marginal_cost=0.1)
    n.add("Generator", "gen_reservoir", bus="busA", p_nom=500.0, carrier="hydro_reservoir",  marginal_cost=7.0)
    n.add("Generator", "gen_thermique", bus="busB", p_nom=300.0, carrier="thermique",        marginal_cost=30.0)

    n.add("Load", "load1", bus="busA")
    n.add("Load", "load2", bus="busB")

    rng = np.random.default_rng(42)
    n.loads_t.p_set["load1"] = pd.Series(rng.uniform(100, 160, n_hours), index=idx)
    n.loads_t.p_set["load2"] = pd.Series(rng.uniform(80, 120, n_hours), index=idx)
    n.generators_t.p_max_pu["gen_eolien"] = pd.Series(rng.uniform(0.5, 1.0, n_hours), index=idx)
    n.generators_t.marginal_cost["gen_reservoir"] = pd.Series(np.full(n_hours, 7.0), index=idx)
    n.generators_t.marginal_cost["gen_thermique"] = pd.Series(np.full(n_hours, 30.0), index=idx)

    return n


def _make_daily_network() -> pypsa.Network:
    idx = pd.date_range("2024-01-01", periods=3, freq="24h")
    n = pypsa.Network()
    n.set_snapshots(idx)
    n.add("Bus", "bus1")
    n.add("Generator", "g1", bus="bus1", p_nom=100.0, carrier="eolien", marginal_cost=0.1)
    n.add("Load", "l1", bus="bus1")
    n.loads_t.p_set["l1"] = pd.Series([50.0, 60.0, 55.0], index=idx)
    return n


# ── NetworkOptimizer: __init__ ─────────────────────────────────────────────────

class TestNetworkOptimizerInit:
    def test_hourly_network_not_journalier(self):
        n = _make_network(n_hours=4)
        opt = NetworkOptimizer(n)
        assert opt.is_journalier is False

    def test_daily_network_is_journalier(self):
        n = _make_daily_network()
        opt = NetworkOptimizer(n)
        assert opt.is_journalier is True

    def test_explicit_override_true(self):
        n = _make_network()
        opt = NetworkOptimizer(n, is_journalier=True)
        assert opt.is_journalier is True

    def test_explicit_override_false(self):
        n = _make_daily_network()
        opt = NetworkOptimizer(n, is_journalier=False)
        assert opt.is_journalier is False

    def test_stores_network(self):
        n = _make_network()
        opt = NetworkOptimizer(n)
        assert opt.network is n

    def test_default_solver_highs(self):
        n = _make_network()
        opt = NetworkOptimizer(n)
        assert opt.solver_name == "highs"


# ── NetworkOptimizer: optimize_manually ───────────────────────────────────────

class TestNetworkOptimizerOptimize:
    @pytest.fixture
    def optimized(self):
        n = _make_network()
        opt = NetworkOptimizer(n)
        opt.optimize_manually()
        return opt

    def test_returns_network(self):
        n = _make_network()
        result = NetworkOptimizer(n).optimize_manually()
        assert isinstance(result, pypsa.Network)

    def test_production_array_exists(self, optimized):
        assert "p" in optimized.network.generators_t

    def test_production_shape(self, optimized):
        p = optimized.network.generators_t["p"]
        assert p.shape == (4, 3)  # 4 snapshots × 3 generators

    def test_production_nonnegative(self, optimized):
        p = optimized.network.generators_t["p"]
        assert (p.values >= 0).all()

    def test_status_ok(self, optimized):
        assert optimized.network.status == "ok"

    def test_termination_condition_manual(self, optimized):
        assert optimized.network.termination_condition == "manual"

    def test_total_production_covers_load(self, optimized):
        total_load = optimized.network.loads_t.p_set.sum(axis=1)
        total_prod = optimized.network.generators_t["p"].sum(axis=1)
        # Production should be >= load at every snapshot
        assert (total_prod.values >= total_load.values - 1e-6).all()

    def test_lines_t_set(self, optimized):
        assert "p0" in optimized.network.lines_t
        assert "q0" in optimized.network.lines_t


# ── NetworkOptimizer: get_optimization_results ────────────────────────────────

class TestNetworkOptimizerResults:
    @pytest.fixture
    def results(self):
        n = _make_network()
        opt = NetworkOptimizer(n)
        opt.optimize_manually()
        return opt.get_optimization_results()

    def test_has_status(self, results):
        assert "status" in results
        assert results["status"] == "ok"

    def test_has_objective_value(self, results):
        assert "objective_value" in results
        assert isinstance(results["objective_value"], float)

    def test_has_production_by_type(self, results):
        assert "production_by_type" in results
        assert isinstance(results["production_by_type"], pd.DataFrame)

    def test_pilotable_production_nonneg(self, results):
        assert results["pilotable_production"] >= 0

    def test_non_pilotable_production_nonneg(self, results):
        assert results["non_pilotable_production"] >= 0

    def test_line_loading_max_is_series(self, results):
        assert isinstance(results["line_loading_max"], pd.Series)


# ── NetworkOptimizer: check_optimization_feasibility ─────────────────────────

class TestNetworkOptimizerFeasibility:
    def test_sufficient_capacity_is_feasible(self):
        n = _make_network()  # 1000 MW capacity vs ~230 MW avg load
        opt = NetworkOptimizer(n)
        feasible, msg = opt.check_optimization_feasibility()
        assert feasible is True

    def test_insufficient_capacity_not_feasible(self):
        idx = pd.date_range("2024-01-01", periods=2, freq="h")
        n = pypsa.Network()
        n.set_snapshots(idx)
        n.add("Bus", "bus1")
        n.add("Line", "l1", bus0="bus1", bus1="bus1", x=0.1, r=0.01, s_nom=10.0)
        n.add("Generator", "g1", bus="bus1", p_nom=10.0, carrier="eolien", marginal_cost=0.1)
        n.add("Load", "load1", bus="bus1")
        n.loads_t.p_set["load1"] = pd.Series([9999.0, 9999.0], index=idx)
        opt = NetworkOptimizer(n)
        feasible, msg = opt.check_optimization_feasibility()
        assert feasible is False

    def test_returns_tuple(self):
        n = _make_network()
        result = NetworkOptimizer(n).check_optimization_feasibility()
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_message_is_string(self):
        n = _make_network()
        _, msg = NetworkOptimizer(n).check_optimization_feasibility()
        assert isinstance(msg, str)


# ── TimeSeriesManager: find_peak_demand ───────────────────────────────────────

class TestTimeSeriesManagerPeakDemand:
    @pytest.fixture
    def network(self):
        return _make_network(n_hours=10)

    def test_returns_series(self, network):
        result = TimeSeriesManager.find_peak_demand(network)
        assert isinstance(result, pd.Series)

    def test_returns_at_most_5(self, network):
        result = TimeSeriesManager.find_peak_demand(network)
        assert len(result) <= 5

    def test_values_are_highest(self, network):
        result = TimeSeriesManager.find_peak_demand(network)
        total = network.loads_t.p_set.sum(axis=1)
        assert result.min() >= total.min()

    def test_period_filter(self, network):
        result = TimeSeriesManager.find_peak_demand(network, period="2024-01")
        assert isinstance(result, pd.Series)


# ── TimeSeriesManager: get_time_resolution ────────────────────────────────────

class TestTimeSeriesManagerResolution:
    def test_hourly_network(self):
        n = _make_network()
        res = TimeSeriesManager.get_time_resolution(n)
        assert "01:00:00" in res or "1 hour" in res.lower() or "0 days" in res

    def test_single_snapshot_returns_na(self):
        n = pypsa.Network()
        n.set_snapshots(pd.date_range("2024-01-01", periods=1, freq="h"))
        assert TimeSeriesManager.get_time_resolution(n) == "N/A"

    def test_daily_network(self):
        n = _make_daily_network()
        res = TimeSeriesManager.get_time_resolution(n)
        assert "day" in res.lower() or "24" in res or "1 days" in res


# ── TimeSeriesManager: check_temporal_consistency ────────────────────────────

class TestTimeSeriesManagerConsistency:
    def test_consistent_when_indices_match(self):
        idx = pd.date_range("2024-01-01", periods=3, freq="h")
        n = pypsa.Network()
        n.set_snapshots(idx)
        n.add("Bus", "b1")
        n.add("Generator", "g1", bus="b1", p_nom=100, carrier="eolien", marginal_cost=0.1)
        n.add("Load", "l1", bus="b1")

        n.loads_t.p_set["l1"] = pd.Series([50.0, 60.0, 55.0], index=idx)
        n.generators_t.p_max_pu["g1"] = pd.Series([0.8, 0.7, 0.9], index=idx)
        n.generators_t.marginal_cost["g1"] = pd.Series([0.1, 0.1, 0.1], index=idx)

        assert TimeSeriesManager.check_temporal_consistency(n) is True

    def test_inconsistent_when_indices_differ(self):
        idx1 = pd.date_range("2024-01-01", periods=3, freq="h")
        idx2 = pd.date_range("2024-01-02", periods=3, freq="h")
        n = pypsa.Network()
        n.set_snapshots(idx1)
        n.add("Bus", "b1")
        n.add("Generator", "g1", bus="b1", p_nom=100, carrier="eolien", marginal_cost=0.1)
        n.add("Load", "l1", bus="b1")

        n.loads_t.p_set["l1"] = pd.Series([50.0, 60.0, 55.0], index=idx1)
        # Replace the DataFrame directly so PyPSA can't realign to snapshots
        n.generators_t.p_max_pu = pd.DataFrame({"g1": [0.8, 0.7, 0.9]}, index=idx2)
        n.generators_t.marginal_cost["g1"] = pd.Series([0.1, 0.1, 0.1], index=idx1)

        assert TimeSeriesManager.check_temporal_consistency(n) is False


# ── TimeSeriesManager: analyze_production_patterns ───────────────────────────

class TestTimeSeriesManagerProduction:
    @pytest.fixture
    def network(self):
        return _make_network(n_hours=6)

    def test_with_eolien_carrier(self, network):
        result = TimeSeriesManager.analyze_production_patterns(network, carrier="eolien")
        assert isinstance(result, pd.DataFrame)
        assert "hour" in result.columns

    def test_with_reservoir_carrier(self, network):
        result = TimeSeriesManager.analyze_production_patterns(network, carrier="hydro_reservoir")
        assert isinstance(result, pd.DataFrame)

    def test_without_carrier(self, network):
        result = TimeSeriesManager.analyze_production_patterns(network)
        assert isinstance(result, pd.DataFrame)
        assert "hour" in result.columns
        assert "month" in result.columns
