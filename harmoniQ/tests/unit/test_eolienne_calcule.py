import numpy as np
import pandas as pd
import pytest

from harmoniq.modules.eolienne.calcule import (
    adjust_wind_speed,
    air_density,
    piecewise_power_curve,
    infer_rated_speed,
    power_from_real_curve,
    apply_directional_losses,
    apply_wake_losses,
    ice_loss_factor,
)


class TestAdjustWindSpeed:
    def test_same_height_returns_same_speed(self):
        v = adjust_wind_speed(10.0, 100.0, 100.0)
        assert abs(v - 10.0) < 1e-9

    def test_higher_hub_returns_faster_speed(self):
        v_low = adjust_wind_speed(10.0, 10.0, 50.0)
        v_high = adjust_wind_speed(10.0, 10.0, 100.0)
        assert v_high > v_low

    def test_zero_speed_returns_zero(self):
        assert adjust_wind_speed(0.0, 10.0, 80.0) == 0.0

    def test_result_proportional_to_input_speed(self):
        v1 = adjust_wind_speed(5.0, 10.0, 80.0)
        v2 = adjust_wind_speed(10.0, 10.0, 80.0)
        assert abs(v2 / v1 - 2.0) < 1e-9


class TestAirDensity:
    def test_standard_conditions(self):
        rho = air_density(temperature=288.15, pressure=101325)
        assert abs(rho - 1.225) < 0.01

    def test_higher_temp_lower_density(self):
        rho_cold = air_density(270.0, 101325)
        rho_warm = air_density(300.0, 101325)
        assert rho_cold > rho_warm

    def test_higher_pressure_higher_density(self):
        rho_low = air_density(288.15, 90000)
        rho_high = air_density(288.15, 110000)
        assert rho_high > rho_low

    def test_returns_positive(self):
        assert air_density(300.0, 101325) > 0


class TestPiecewisePowerCurve:
    CUT_IN = 3.0
    RATED = 12.0
    CUT_OUT = 25.0
    P_NOM = 2000.0

    def _power(self, v):
        return piecewise_power_curve(
            np.array(v, dtype=float),
            self.CUT_IN, self.RATED, self.CUT_OUT, self.P_NOM
        )

    def test_below_cut_in_is_zero(self):
        assert self._power([0.0, 2.9])[0] == 0.0
        assert self._power([0.0, 2.9])[1] == 0.0

    def test_above_cut_out_is_zero(self):
        assert self._power([26.0])[0] == 0.0

    def test_at_rated_speed_is_nominal(self):
        p = self._power([self.RATED])
        assert abs(p[0] - self.P_NOM) < 1e-6

    def test_between_rated_and_cut_out_is_nominal(self):
        p = self._power([15.0, 20.0])
        assert abs(p[0] - self.P_NOM) < 1e-6
        assert abs(p[1] - self.P_NOM) < 1e-6

    def test_rise_zone_between_zero_and_nominal(self):
        p = self._power([6.0])
        assert 0 < p[0] < self.P_NOM

    def test_monotone_in_rise_zone(self):
        speeds = np.linspace(self.CUT_IN, self.RATED, 20)
        powers = piecewise_power_curve(speeds, self.CUT_IN, self.RATED, self.CUT_OUT, self.P_NOM)
        assert np.all(np.diff(powers) >= 0)


class TestInferRatedSpeed:
    def test_uses_explicit_rated_speed(self):
        turbine = {"rated_wind_speed": 14.0}
        rated = infer_rated_speed(turbine, cut_in_speed=3.0, cut_out_speed=25.0)
        assert rated == 14.0

    def test_falls_back_to_12_when_missing(self):
        turbine = {}
        rated = infer_rated_speed(turbine, cut_in_speed=3.0, cut_out_speed=25.0)
        assert rated == 12.0

    def test_clips_explicit_speed_outside_range(self):
        turbine = {"rated_wind_speed": 30.0}
        rated = infer_rated_speed(turbine, cut_in_speed=3.0, cut_out_speed=25.0)
        assert rated < 25.0

    def test_default_clipped_between_cut_in_and_cut_out(self):
        turbine = {}
        rated = infer_rated_speed(turbine, cut_in_speed=3.0, cut_out_speed=10.0)
        assert 3.0 < rated < 10.0


class TestPowerFromRealCurve:
    def _make_curve(self):
        return pd.DataFrame({"wind_speed": [0, 5, 10, 15], "power": [0, 500_000, 2_000_000, 2_000_000]})

    def test_returns_none_without_curve(self):
        result = power_from_real_curve(np.array([5.0]), {}, 3.0, 25.0)
        assert result is None

    def test_returns_none_when_curve_not_dataframe(self):
        result = power_from_real_curve(np.array([5.0]), {"power_curve": "bad"}, 3.0, 25.0)
        assert result is None

    def test_returns_none_with_missing_columns(self):
        df = pd.DataFrame({"wind_speed": [5]})
        result = power_from_real_curve(np.array([5.0]), {"power_curve": df}, 3.0, 25.0)
        assert result is None

    def test_returns_array_with_valid_curve(self):
        curve = self._make_curve()
        result = power_from_real_curve(np.array([5.0, 10.0]), {"power_curve": curve}, 3.0, 25.0)
        assert result is not None
        assert len(result) == 2

    def test_zero_below_cut_in(self):
        curve = self._make_curve()
        result = power_from_real_curve(np.array([1.0]), {"power_curve": curve}, 3.0, 25.0)
        assert result[0] == 0.0

    def test_zero_above_cut_out(self):
        curve = self._make_curve()
        result = power_from_real_curve(np.array([30.0]), {"power_curve": curve}, 3.0, 25.0)
        assert result[0] == 0.0


class TestApplyDirectionalLosses:
    def test_optimal_direction_no_loss(self):
        loss = apply_directional_losses(np.array([180.0]))
        assert abs(loss[0] - 1.0) < 1e-9

    def test_max_deviation_clips_at_07(self):
        loss = apply_directional_losses(np.array([0.0]))
        assert abs(loss[0] - 0.7) < 1e-9

    def test_loss_between_07_and_1(self):
        loss = apply_directional_losses(np.array([90.0, 270.0]))
        assert np.all(loss >= 0.7)
        assert np.all(loss <= 1.0)

    def test_symmetric_around_180(self):
        loss_left = apply_directional_losses(np.array([90.0]))
        loss_right = apply_directional_losses(np.array([270.0]))
        assert abs(loss_left[0] - loss_right[0]) < 1e-9


class TestApplyWakeLosses:
    def test_near_180_applies_10pct_loss(self):
        loss = apply_wake_losses(np.array([180.0, 170.0, 190.0]))
        assert np.all(loss == 0.9)

    def test_far_from_180_no_loss(self):
        loss = apply_wake_losses(np.array([0.0, 90.0, 270.0]))
        assert np.all(loss == 1.0)

    def test_boundary_at_30_degrees(self):
        just_inside = apply_wake_losses(np.array([151.0]))
        just_outside = apply_wake_losses(np.array([149.0]))
        assert just_inside[0] == 0.9
        assert just_outside[0] == 1.0


class TestIceLossFactor:
    def test_warm_temperatures_no_loss(self):
        losses = ice_loss_factor(np.array([280.0, 300.0]))
        assert np.all(losses == 1.0)

    def test_moderate_cold_80pct(self):
        losses = ice_loss_factor(np.array([265.0, 270.0]))
        assert np.all(losses == 0.80)

    def test_very_cold_60pct(self):
        losses = ice_loss_factor(np.array([250.0, 255.0]))
        assert np.all(losses == 0.60)

    def test_boundary_at_minus_10c(self):
        assert ice_loss_factor(np.array([262.0]))[0] == 0.60
        assert ice_loss_factor(np.array([264.0]))[0] == 0.80

    def test_boundary_at_zero_c(self):
        assert ice_loss_factor(np.array([272.0]))[0] == 0.80
        assert ice_loss_factor(np.array([274.0]))[0] == 1.00

    def test_all_nan_returns_ones(self):
        losses = ice_loss_factor(np.array([np.nan, np.nan]))
        assert np.all(losses == 1.0)

    def test_stochastic_flag_ignored(self):
        losses_true = ice_loss_factor(np.array([260.0]), stochastic=True)
        losses_false = ice_loss_factor(np.array([260.0]), stochastic=False)
        assert losses_true[0] == losses_false[0]
