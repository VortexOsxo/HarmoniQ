import numpy as np
import pandas as pd
import pytest

from harmoniq.modules.reseau.utils.energy_utils import EnergyUtils


class TestObtenir_energie_historique:
    def test_known_year_2022(self):
        assert EnergyUtils.obtenir_energie_historique("2022") == 210.8e6

    def test_known_year_2023(self):
        assert EnergyUtils.obtenir_energie_historique("2023") == 205.2e6

    def test_known_year_2024(self):
        assert EnergyUtils.obtenir_energie_historique("2024") == 208.0e6

    def test_unknown_year_returns_average(self):
        result = EnergyUtils.obtenir_energie_historique("2000")
        expected = (210.8e6 + 205.2e6 + 208.0e6) / 3
        assert abs(result - expected) < 1.0

    def test_returns_float(self):
        assert isinstance(EnergyUtils.obtenir_energie_historique("2022"), float)


class TestCalcul_cout_reservoir:
    def test_full_reservoir_returns_minimum_cost(self):
        cost = EnergyUtils.calcul_cout_reservoir(1.0)
        assert cost == 5.0

    def test_at_critical_level_still_linear(self):
        cost = EnergyUtils.calcul_cout_reservoir(0.25)
        assert isinstance(cost, float)

    def test_empty_reservoir_high_cost(self):
        cost_empty = EnergyUtils.calcul_cout_reservoir(0.0)
        cost_full = EnergyUtils.calcul_cout_reservoir(1.0)
        assert cost_empty > cost_full

    def test_below_critical_exponential_growth(self):
        cost_low = EnergyUtils.calcul_cout_reservoir(0.1)
        cost_high = EnergyUtils.calcul_cout_reservoir(0.2)
        assert cost_low > cost_high

    def test_clamps_above_1(self):
        cost_1 = EnergyUtils.calcul_cout_reservoir(1.0)
        cost_2 = EnergyUtils.calcul_cout_reservoir(2.0)
        assert cost_1 == cost_2

    def test_clamps_below_0(self):
        cost_0 = EnergyUtils.calcul_cout_reservoir(0.0)
        cost_neg = EnergyUtils.calcul_cout_reservoir(-0.5)
        assert cost_0 == cost_neg

    def test_returns_rounded_float(self):
        cost = EnergyUtils.calcul_cout_reservoir(0.5)
        assert cost == round(cost, 2)


class TestCalcul_cout_reservoir_vectorized:
    def test_returns_ndarray(self):
        result = EnergyUtils.calcul_cout_reservoir_vectorized(np.array([0.5, 0.8]))
        assert isinstance(result, np.ndarray)

    def test_full_reservoir_returns_minimum(self):
        result = EnergyUtils.calcul_cout_reservoir_vectorized(np.array([1.0]))
        assert result[0] == 5.0

    def test_matches_scalar_version(self):
        levels = np.array([0.1, 0.25, 0.5, 0.75, 1.0])
        vec = EnergyUtils.calcul_cout_reservoir_vectorized(levels)
        for i, level in enumerate(levels):
            scalar = EnergyUtils.calcul_cout_reservoir(float(level))
            assert abs(vec[i] - scalar) < 0.01, f"mismatch at level={level}"

    def test_clips_out_of_range(self):
        result = EnergyUtils.calcul_cout_reservoir_vectorized(np.array([-1.0, 2.0]))
        result_in = EnergyUtils.calcul_cout_reservoir_vectorized(np.array([0.0, 1.0]))
        np.testing.assert_array_equal(result, result_in)

    def test_monotone_decreasing_above_critical(self):
        levels = np.linspace(0.25, 1.0, 20)
        costs = EnergyUtils.calcul_cout_reservoir_vectorized(levels)
        assert np.all(np.diff(costs) <= 0)


class TestGenerer_faux_niveaux_reservoirs:
    SNAPSHOTS = pd.date_range("2035-01-01", periods=24, freq="h")
    BARRAGES = ["Manic-5", "LG-2", "Outardes-4"]

    def test_returns_dataframe(self):
        df = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES)
        assert isinstance(df, pd.DataFrame)

    def test_correct_shape(self):
        df = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES)
        assert df.shape == (len(self.SNAPSHOTS), len(self.BARRAGES))

    def test_correct_columns(self):
        df = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES)
        assert list(df.columns) == self.BARRAGES

    def test_values_clipped_between_01_and_1(self):
        df = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES)
        assert (df.values >= 0.1).all()
        assert (df.values <= 1.0).all()

    def test_seed_produces_reproducible_results(self):
        df1 = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES, seed=42)
        df2 = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES, seed=42)
        pd.testing.assert_frame_equal(df1, df2)

    def test_different_seeds_produce_different_results(self):
        df1 = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES, seed=1)
        df2 = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES, seed=2)
        assert not df1.equals(df2)

    def test_correct_index(self):
        df = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, self.BARRAGES)
        assert list(df.index) == list(self.SNAPSHOTS)

    def test_single_barrage(self):
        df = EnergyUtils.generer_faux_niveaux_reservoirs(self.SNAPSHOTS, ["LG-1"])
        assert df.shape == (24, 1)


class TestEstimer_production_annuelle:
    def _make_gen(self, carrier, p_nom):
        class FakeGen:
            pass
        g = FakeGen()
        g.carrier = carrier
        g.p_nom = p_nom
        return g

    def test_hydro_fil_factor(self):
        gen = self._make_gen("hydro_fil", 1000)
        result = EnergyUtils.estimer_production_annuelle(gen)
        assert abs(result - 1000 * 0.5 * 8760) < 1.0

    def test_nucleaire_factor(self):
        gen = self._make_gen("nucleaire", 900)
        result = EnergyUtils.estimer_production_annuelle(gen)
        assert abs(result - 900 * 0.90 * 8760) < 1.0

    def test_unknown_carrier_uses_05(self):
        gen = self._make_gen("unknown_type", 500)
        result = EnergyUtils.estimer_production_annuelle(gen)
        assert abs(result - 500 * 0.5 * 8760) < 1.0

    def test_zero_pnom_returns_zero(self):
        gen = self._make_gen("eolien", 0)
        assert EnergyUtils.estimer_production_annuelle(gen) == 0.0


class TestCalculate_energy_from_power:
    def _make_network(self, n_snapshots, freq="h"):
        class FakeNetwork:
            pass
        net = FakeNetwork()
        net.snapshots = pd.date_range("2035-01-01", periods=n_snapshots, freq=freq)
        return net

    def test_hourly_no_conversion(self):
        net = self._make_network(24, "h")
        data = pd.DataFrame({"A": [100.0] * 24}, index=net.snapshots)
        result = EnergyUtils.calculate_energy_from_power(net, data)
        assert result["A"].iloc[0] == 100.0

    def test_daily_multiplies_by_24(self):
        net = self._make_network(7, "D")
        data = pd.DataFrame({"A": [100.0] * 7}, index=net.snapshots)
        result = EnergyUtils.calculate_energy_from_power(net, data)
        assert result["A"].iloc[0] == 2400.0

    def test_force_journalier_override(self):
        net = self._make_network(24, "h")
        data = pd.DataFrame({"A": [50.0] * 24}, index=net.snapshots)
        result = EnergyUtils.calculate_energy_from_power(net, data, is_journalier=True)
        assert result["A"].iloc[0] == 1200.0

    def test_force_not_journalier_override(self):
        net = self._make_network(7, "D")
        data = pd.DataFrame({"A": [100.0] * 7}, index=net.snapshots)
        result = EnergyUtils.calculate_energy_from_power(net, data, is_journalier=False)
        assert result["A"].iloc[0] == 100.0

    def test_series_input(self):
        net = self._make_network(7, "D")
        data = pd.Series([100.0] * 7, index=net.snapshots)
        result = EnergyUtils.calculate_energy_from_power(net, data)
        assert result.iloc[0] == 2400.0

    def test_single_snapshot_stays_hourly(self):
        net = self._make_network(1, "h")
        data = pd.DataFrame({"A": [200.0]}, index=net.snapshots)
        result = EnergyUtils.calculate_energy_from_power(net, data)
        assert result["A"].iloc[0] == 200.0
