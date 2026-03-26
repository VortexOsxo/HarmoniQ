import numpy as np
import pandas as pd
import pytest
from unittest.mock import MagicMock, patch

from harmoniq.modules.reseau.utils.energy_utils import EnergyUtils


def _make_mock_network(bus_names=("A", "B"), snapshots=None):
    net = MagicMock()
    if snapshots is None:
        snapshots = pd.date_range("2024-01-01", periods=24, freq="h")
    net.snapshots = snapshots
    buses = pd.DataFrame({"x": [0.0, 1.0], "y": [0.0, 1.0]}, index=list(bus_names))
    net.buses = buses
    return net


class TestObtenirEnergieHistorique:
    def test_known_year_2022(self):
        assert EnergyUtils.obtenir_energie_historique("2022") == pytest.approx(210.8e6)

    def test_known_year_2023(self):
        assert EnergyUtils.obtenir_energie_historique("2023") == pytest.approx(205.2e6)

    def test_known_year_2024(self):
        assert EnergyUtils.obtenir_energie_historique("2024") == pytest.approx(208.0e6)

    def test_unknown_year_returns_average(self):
        known = {"2022": 210.8e6, "2023": 205.2e6, "2024": 208.0e6}
        expected = sum(known.values()) / 3
        result = EnergyUtils.obtenir_energie_historique("2099")
        assert result == pytest.approx(expected)


class TestIdentifierNouvellesCentrales:
    def test_returns_empty_list(self):
        net = _make_mock_network()
        result = EnergyUtils.identifier_nouvelles_centrales(net)
        assert result == []


class TestEstimerProductionAnnuelle:
    @pytest.mark.parametrize("carrier,factor", [
        ("hydro_fil", 0.5),
        ("hydro_reservoir", 0.55),
        ("eolien", 0.35),
        ("solaire", 0.18),
        ("thermique", 0.85),
        ("nucléaire", 0.90),
    ])
    def test_capacity_factor_applied(self, carrier, factor):
        centrale = MagicMock()
        centrale.p_nom = 100.0
        centrale.carrier = carrier
        expected = 100.0 * factor * 8760
        assert EnergyUtils.estimer_production_annuelle(centrale) == pytest.approx(expected)

    def test_unknown_carrier_uses_default_factor(self):
        centrale = MagicMock()
        centrale.p_nom = 200.0
        centrale.carrier = "unknown_source"
        result = EnergyUtils.estimer_production_annuelle(centrale)
        expected = 200.0 * 0.5 * 8760
        assert result == pytest.approx(expected)


class TestCalculCoutReservoir:
    def test_full_reservoir_near_minimum_cost(self):
        cost = EnergyUtils.calcul_cout_reservoir(1.0)
        assert cost == pytest.approx(5.0, abs=1.0)

    def test_empty_reservoir_high_cost(self):
        cost = EnergyUtils.calcul_cout_reservoir(0.0)
        assert cost > 20.0

    def test_cost_bounded_above_minimum(self):
        for niveau in [0.0, 0.1, 0.5, 0.9, 1.0]:
            assert EnergyUtils.calcul_cout_reservoir(niveau) >= 5.0

    def test_cost_below_critical_uses_exponential(self):
        cost_low = EnergyUtils.calcul_cout_reservoir(0.0)
        cost_mid = EnergyUtils.calcul_cout_reservoir(0.12)
        cost_near = EnergyUtils.calcul_cout_reservoir(0.24)
        assert cost_low > cost_mid > cost_near

    def test_clipping_below_zero(self):
        cost_neg = EnergyUtils.calcul_cout_reservoir(-1.0)
        cost_zero = EnergyUtils.calcul_cout_reservoir(0.0)
        assert cost_neg == pytest.approx(cost_zero)

    def test_clipping_above_one(self):
        cost_over = EnergyUtils.calcul_cout_reservoir(1.5)
        cost_one = EnergyUtils.calcul_cout_reservoir(1.0)
        assert cost_over == pytest.approx(cost_one)

    def test_returns_rounded_value(self):
        cost = EnergyUtils.calcul_cout_reservoir(0.5)
        assert cost == round(cost, 2)


class TestCalculCoutReservoirVectorized:
    def test_output_shape_matches_input(self):
        niveaux = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
        result = EnergyUtils.calcul_cout_reservoir_vectorized(niveaux)
        assert result.shape == niveaux.shape

    def test_consistent_with_scalar_version(self):
        niveaux = np.array([0.0, 0.2, 0.5, 0.75, 1.0])
        vec = EnergyUtils.calcul_cout_reservoir_vectorized(niveaux)
        for i, n in enumerate(niveaux):
            scalar = EnergyUtils.calcul_cout_reservoir(n)
            assert vec[i] == pytest.approx(scalar, abs=0.01)

    def test_empty_array_returns_empty(self):
        result = EnergyUtils.calcul_cout_reservoir_vectorized(np.array([]))
        assert len(result) == 0

    def test_values_clipped_and_non_negative(self):
        niveaux = np.array([-0.5, 0.0, 0.5, 1.0, 1.5])
        result = EnergyUtils.calcul_cout_reservoir_vectorized(niveaux)
        assert np.all(result >= 5.0)


class TestGenererFauxNiveauxReservoirs:
    def test_returns_dataframe(self):
        snapshots = pd.date_range("2024-01-01", periods=24, freq="h")
        result = EnergyUtils.generer_faux_niveaux_reservoirs(snapshots, ["Dam1", "Dam2"])
        assert isinstance(result, pd.DataFrame)

    def test_shape_matches_inputs(self):
        snapshots = pd.date_range("2024-01-01", periods=48, freq="h")
        barrages = ["A", "B", "C"]
        result = EnergyUtils.generer_faux_niveaux_reservoirs(snapshots, barrages)
        assert result.shape == (48, 3)
        assert list(result.columns) == barrages

    def test_levels_bounded_between_0_1_and_1_0(self):
        snapshots = pd.date_range("2024-01-01", periods=100, freq="h")
        result = EnergyUtils.generer_faux_niveaux_reservoirs(snapshots, ["Dam1"])
        assert (result >= 0.1).all().all()
        assert (result <= 1.0).all().all()

    def test_reproducible_with_seed(self):
        snapshots = pd.date_range("2024-01-01", periods=24, freq="h")
        r1 = EnergyUtils.generer_faux_niveaux_reservoirs(snapshots, ["Dam1"], seed=42)
        r2 = EnergyUtils.generer_faux_niveaux_reservoirs(snapshots, ["Dam1"], seed=42)
        pd.testing.assert_frame_equal(r1, r2)

    def test_different_seeds_differ(self):
        snapshots = pd.date_range("2024-01-01", periods=24, freq="h")
        r1 = EnergyUtils.generer_faux_niveaux_reservoirs(snapshots, ["Dam1"], seed=1)
        r2 = EnergyUtils.generer_faux_niveaux_reservoirs(snapshots, ["Dam1"], seed=2)
        assert not r1.equals(r2)


class TestCalculateEnergyFromPower:
    def _hourly_network(self):
        net = MagicMock()
        net.snapshots = pd.date_range("2024-01-01", periods=24, freq="h")
        return net

    def _daily_network(self):
        net = MagicMock()
        net.snapshots = pd.date_range("2024-01-01", periods=7, freq="D")
        return net

    def test_hourly_mode_no_multiplication(self):
        net = self._hourly_network()
        power = pd.DataFrame({"gen1": [100.0] * 24}, index=net.snapshots)
        energy = EnergyUtils.calculate_energy_from_power(net, power)
        pd.testing.assert_frame_equal(energy, power)

    def test_daily_mode_multiplies_by_24(self):
        net = self._daily_network()
        power = pd.DataFrame({"gen1": [100.0] * 7}, index=net.snapshots)
        energy = EnergyUtils.calculate_energy_from_power(net, power)
        expected = power * 24
        pd.testing.assert_frame_equal(energy, expected)

    def test_explicit_is_journalier_true(self):
        net = self._hourly_network()
        power = pd.DataFrame({"gen1": [50.0] * 24}, index=net.snapshots)
        energy = EnergyUtils.calculate_energy_from_power(net, power, is_journalier=True)
        assert np.allclose(energy["gen1"].values, 50.0 * 24)

    def test_explicit_is_journalier_false(self):
        net = self._daily_network()
        power = pd.DataFrame({"gen1": [50.0] * 7}, index=net.snapshots)
        energy = EnergyUtils.calculate_energy_from_power(net, power, is_journalier=False)
        assert np.allclose(energy["gen1"].values, 50.0)

    def test_series_input_handled(self):
        net = self._daily_network()
        power = pd.Series([10.0] * 7, index=net.snapshots)
        energy = EnergyUtils.calculate_energy_from_power(net, power)
        assert np.allclose(energy.values, 240.0)

    def test_already_energy_flag_prevents_double_multiplication(self):
        net = self._daily_network()
        power = pd.DataFrame({"gen1": [100.0] * 7}, index=net.snapshots)
        power._energy_not_power = True
        energy = EnergyUtils.calculate_energy_from_power(net, power)
        pd.testing.assert_frame_equal(energy, power)
