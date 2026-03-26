import numpy as np
import pandas as pd
import pytest
from unittest.mock import patch, MagicMock

from harmoniq.modules.eolienne.calcule import (
    adjust_wind_speed,
    air_density,
    piecewise_power_curve,
    apply_directional_losses,
    apply_wake_losses,
    ice_loss_factor,
    get_parc_power,
)


@pytest.fixture
def basic_wind_speeds():
    return np.array([0.0, 3.0, 7.0, 12.0, 15.0, 25.0, 30.0])


@pytest.fixture
def mock_parc():
    parc = MagicMock()
    parc.modele_turbine = "MM92"
    parc.hauteur_moyenne = 80
    parc.nombre_eoliennes = 10
    parc.puissance_nominal = 2000.0
    return parc


@pytest.fixture
def minimal_meteo_df():
    idx = pd.date_range("2024-01-01", periods=5, freq="h")
    return pd.DataFrame(
        {
            "temperature_C": [5.0, -5.0, 10.0, 0.0, 15.0],
            "vitesse_vent_kmh": [20.0, 30.0, 10.0, 0.0, 50.0],
            "direction_vent": [180.0, 90.0, 200.0, 270.0, 180.0],
        },
        index=idx,
    )


class TestAdjustWindSpeed:
    def test_same_height_returns_same_speed(self):
        result = adjust_wind_speed(10.0, z_meteo=10, z_eolien=10)
        assert result == pytest.approx(10.0)

    def test_higher_hub_gives_higher_speed(self):
        result = adjust_wind_speed(10.0, z_meteo=10, z_eolien=80)
        assert result > 10.0

    def test_lower_hub_gives_lower_speed(self):
        result = adjust_wind_speed(10.0, z_meteo=80, z_eolien=10)
        assert result < 10.0

    def test_zero_speed_stays_zero(self):
        result = adjust_wind_speed(0.0, z_meteo=10, z_eolien=80)
        assert result == 0.0

    def test_logarithmic_profile_formula(self):
        z0 = 0.03
        expected = 10.0 * (np.log(80 / z0) / np.log(10 / z0))
        result = adjust_wind_speed(10.0, z_meteo=10, z_eolien=80)
        assert result == pytest.approx(expected)


class TestAirDensity:
    def test_standard_conditions(self):
        rho = air_density(288.15, 101325)
        assert rho == pytest.approx(1.225, rel=1e-3)

    def test_higher_temperature_lower_density(self):
        rho_cold = air_density(273.15, 101325)
        rho_warm = air_density(303.15, 101325)
        assert rho_cold > rho_warm

    def test_higher_pressure_higher_density(self):
        rho_low = air_density(288.15, 80000)
        rho_high = air_density(288.15, 101325)
        assert rho_high > rho_low

    def test_ideal_gas_law(self):
        T, P, R = 300.0, 100000.0, 287.05
        expected = P / (R * T)
        assert air_density(T, P) == pytest.approx(expected)


class TestPiecewisePowerCurve:
    CUT_IN = 3.0
    RATED = 12.0
    CUT_OUT = 25.0
    RATED_POWER = 2_000_000.0

    def _curve(self, v):
        return piecewise_power_curve(
            v,
            self.CUT_IN,
            self.RATED,
            self.CUT_OUT,
            self.RATED_POWER,
        )

    def test_below_cut_in_is_zero(self):
        v = np.array([0.0, 1.0, 2.9])
        result = self._curve(v)
        assert np.all(result == 0.0)

    def test_above_cut_out_is_zero(self):
        v = np.array([25.1, 30.0, 50.0])
        result = self._curve(v)
        assert np.all(result == 0.0)

    def test_at_rated_speed_is_nominal_power(self):
        v = np.array([self.RATED])
        result = self._curve(v)
        assert result[0] == pytest.approx(self.RATED_POWER)

    def test_between_rated_and_cut_out_is_nominal(self):
        v = np.array([15.0, 20.0, 24.0])
        result = self._curve(v)
        assert np.all(result == pytest.approx(self.RATED_POWER))

    def test_ramp_zone_monotonically_increasing(self):
        v = np.linspace(self.CUT_IN, self.RATED, 20)
        result = self._curve(v)
        assert np.all(np.diff(result) >= 0)

    def test_at_cut_in_speed_is_zero(self):
        v = np.array([self.CUT_IN])
        result = self._curve(v)
        assert result[0] == pytest.approx(0.0)

    def test_custom_exponent(self):
        v = np.array([7.5])
        result_exp3 = piecewise_power_curve(v, 3.0, 12.0, 25.0, 1000.0, 3.0)
        result_exp1 = piecewise_power_curve(v, 3.0, 12.0, 25.0, 1000.0, 1.0)
        assert result_exp3[0] < result_exp1[0]


class TestApplyDirectionalLosses:
    def test_optimal_direction_no_loss(self):
        result = apply_directional_losses(pd.Series([180.0]))
        assert result[0] == pytest.approx(1.0)

    def test_max_deviation_capped_at_0_7(self):
        result = apply_directional_losses(pd.Series([0.0]))
        assert result[0] == pytest.approx(0.7)

    def test_result_bounded_between_0_7_and_1_0(self):
        directions = pd.Series(np.linspace(0, 360, 100))
        result = apply_directional_losses(directions)
        assert np.all(result >= 0.7)
        assert np.all(result <= 1.0)

    def test_symmetry_around_180(self):
        r1 = apply_directional_losses(pd.Series([160.0]))
        r2 = apply_directional_losses(pd.Series([200.0]))
        assert r1[0] == pytest.approx(r2[0])


class TestApplyWakeLosses:
    def test_within_30_degrees_of_180_gives_0_9(self):
        result = apply_wake_losses(pd.Series([180.0]))
        assert result[0] == pytest.approx(0.9)

    def test_exactly_30_degrees_from_180_is_full_power(self):
        result = apply_wake_losses(pd.Series([150.0]))
        assert result[0] == pytest.approx(1.0)

    def test_far_from_180_is_1_0(self):
        result = apply_wake_losses(pd.Series([0.0, 90.0, 270.0]))
        assert np.all(result == pytest.approx(1.0))

    def test_values_are_only_0_9_or_1_0(self):
        directions = pd.Series(np.linspace(0, 360, 100))
        result = apply_wake_losses(directions)
        unique = set(np.round(result, 6))
        assert unique.issubset({0.9, 1.0})


class TestIceLossFactor:
    def test_above_freezing_returns_random_in_range(self):
        np.random.seed(42)
        t = np.array([5.0, 10.0, 20.0])
        result = ice_loss_factor(t)
        assert np.all(result >= 0.5)
        assert np.all(result <= 1.0)

    def test_below_freezing_returns_1_0(self):
        t = np.array([-5.0, -10.0, -20.0])
        result = ice_loss_factor(t)
        assert np.all(result == 1.0)

    def test_output_shape_matches_input(self):
        t = np.zeros(10)
        result = ice_loss_factor(t)
        assert result.shape == (10,)


class TestGetParcPower:
    def test_unknown_turbine_raises_value_error(self, mock_parc, minimal_meteo_df):
        mock_parc.modele_turbine = "UNKNOWN_MODEL"
        with patch("harmoniq.modules.eolienne.calcule.turbine_models", {}):
            with pytest.raises(ValueError, match="Unknown turbine model"):
                get_parc_power(mock_parc, minimal_meteo_df.copy())

    def test_returns_dataframe_with_expected_columns(self, mock_parc, minimal_meteo_df):
        fake_turbine = {"cut_in_wind_speed": 3.0, "cut_out_wind_speed": 25.0}
        with patch("harmoniq.modules.eolienne.calcule.turbine_models", {"MM92": fake_turbine}):
            result = get_parc_power(mock_parc, minimal_meteo_df.copy())

        assert isinstance(result, pd.DataFrame)
        assert "puissance" in result.columns
        assert "vitesse_vent_kmh" in result.columns
        assert "direction_vent" in result.columns
        assert "tempsdate" in result.columns

    def test_power_scaled_by_number_of_turbines(self, minimal_meteo_df):
        fake_turbine = {"cut_in_wind_speed": 3.0, "cut_out_wind_speed": 25.0}

        parc_1 = MagicMock()
        parc_1.modele_turbine = "MM92"
        parc_1.hauteur_moyenne = 80
        parc_1.nombre_eoliennes = 1
        parc_1.puissance_nominal = 2000.0

        parc_10 = MagicMock()
        parc_10.modele_turbine = "MM92"
        parc_10.hauteur_moyenne = 80
        parc_10.nombre_eoliennes = 10
        parc_10.puissance_nominal = 2000.0

        with patch("harmoniq.modules.eolienne.calcule.turbine_models", {"MM92": fake_turbine}):
            np.random.seed(0)
            r1 = get_parc_power(parc_1, minimal_meteo_df.copy())
            np.random.seed(0)
            r10 = get_parc_power(parc_10, minimal_meteo_df.copy())

        ratio = r10["puissance"].values / np.where(r1["puissance"].values != 0, r1["puissance"].values, np.nan)
        non_nan = ratio[~np.isnan(ratio)]
        if len(non_nan) > 0:
            assert np.allclose(non_nan, 10.0, rtol=1e-5)

    def test_zero_wind_gives_zero_power(self, mock_parc):
        fake_turbine = {"cut_in_wind_speed": 3.0, "cut_out_wind_speed": 25.0}
        idx = pd.date_range("2024-01-01", periods=3, freq="h")
        meteo = pd.DataFrame(
            {
                "temperature_C": [10.0, 10.0, 10.0],
                "vitesse_vent_kmh": [0.0, 0.0, 0.0],
                "direction_vent": [180.0, 180.0, 180.0],
            },
            index=idx,
        )
        with patch("harmoniq.modules.eolienne.calcule.turbine_models", {"MM92": fake_turbine}):
            result = get_parc_power(mock_parc, meteo)
        assert np.all(result["puissance"].values == 0.0)
