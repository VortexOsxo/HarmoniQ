"""Tests for nucleaire and thermique production calculation functions."""
import pytest
import pandas as pd
from datetime import datetime

from harmoniq.modules.nucleaire.calculs_production_nucleaire import (
    calculate_nuclear_production,
    co2_emissions_nuclear,
    cost_nuclear_powerplant,
)
from harmoniq.modules.thermique.calculs_production_thermique import (
    calculate_thermique_production,
    assign_maintenance_weeks,
    _get_maintenance_bounds,
)

DATE_START = datetime(2035, 1, 1)
DATE_END = datetime(2035, 12, 31, 23, 0, 0)


class TestCalculateNuclearProduction:
    def test_returns_dataframe(self):
        df = calculate_nuclear_production(900, 10, DATE_START, DATE_END)
        assert isinstance(df, pd.DataFrame)

    def test_has_production_column(self):
        df = calculate_nuclear_production(900, 10, DATE_START, DATE_END)
        assert "production_mwh" in df.columns

    def test_nominal_power_outside_maintenance(self):
        df = calculate_nuclear_production(900, 10, DATE_START, DATE_END)
        non_zero = df[df["production_mwh"] > 0]["production_mwh"]
        assert (non_zero == 900).all()

    def test_maintenance_week_is_zero(self):
        df = calculate_nuclear_production(900, 10, DATE_START, DATE_END)
        assert (df["production_mwh"] == 0).any()

    def test_hourly_index(self):
        df = calculate_nuclear_production(900, 10, DATE_START, DATE_END)
        assert isinstance(df.index, pd.DatetimeIndex)
        assert len(df) == len(pd.date_range(DATE_START, DATE_END, freq="h"))

    def test_zero_power_produces_zeros(self):
        df = calculate_nuclear_production(0, 10, DATE_START, DATE_END)
        assert (df["production_mwh"] == 0).all()


class TestCo2EmissionsNuclear:
    def test_basic_calculation(self):
        result = co2_emissions_nuclear(1_000_000)
        assert result == 1_000_000 * 8 / 1000

    def test_custom_factor(self):
        result = co2_emissions_nuclear(1_000, facteur_emission=10)
        assert result == 10.0

    def test_zero_production(self):
        assert co2_emissions_nuclear(0) == 0.0

    def test_returns_float(self):
        assert isinstance(co2_emissions_nuclear(1000), float)


class TestCostNuclearPowerplant:
    def test_scales_with_power(self):
        assert cost_nuclear_powerplant(1000) == 10_000_000_000
        assert cost_nuclear_powerplant(500) == 5_000_000_000

    def test_zero_power(self):
        assert cost_nuclear_powerplant(0) == 0


class TestAssignMaintenanceWeeks:
    def test_returns_list(self):
        assert isinstance(assign_maintenance_weeks(3), list)

    def test_correct_length(self):
        assert len(assign_maintenance_weeks(5)) == 5

    def test_weeks_in_valid_range(self):
        weeks = assign_maintenance_weeks(10)
        assert all(18 <= w <= 34 for w in weeks)

    def test_single_central(self):
        weeks = assign_maintenance_weeks(1)
        assert len(weeks) == 1

    def test_overflow_wraps_correctly(self):
        amplitude = 34 - 18
        weeks = assign_maintenance_weeks(amplitude + 1)
        assert len(weeks) == amplitude + 1


class TestGetMaintenanceBounds:
    def test_returns_tuple_of_two_datetimes(self):
        start, end = _get_maintenance_bounds(2035, 20)
        assert isinstance(start, datetime)
        assert isinstance(end, datetime)

    def test_duration_is_one_week(self):
        from datetime import timedelta
        start, end = _get_maintenance_bounds(2035, 20)
        assert end - start == timedelta(weeks=1)


class TestCalculateThermiqueProduction:
    def test_returns_dataframe(self):
        df = calculate_thermique_production(500, 20, DATE_START, DATE_END, fuel_type="Gaz naturel")
        assert isinstance(df, pd.DataFrame)

    def test_has_required_columns(self):
        df = calculate_thermique_production(500, 20, DATE_START, DATE_END, fuel_type="Gaz naturel")
        assert {"production_mwh", "name", "fuel_type"}.issubset(df.columns)

    def test_maintenance_week_is_zero(self):
        df = calculate_thermique_production(500, 20, DATE_START, DATE_END, fuel_type="Gaz naturel")
        assert (df["production_mwh"] == 0).any()

    def test_use_efficiency_applies_factor(self):
        df_raw = calculate_thermique_production(500, 20, DATE_START, DATE_END, fuel_type="Gaz naturel", use_efficiency=False)
        df_eff = calculate_thermique_production(500, 20, DATE_START, DATE_END, fuel_type="Gaz naturel", use_efficiency=True)
        non_zero_raw = df_raw[df_raw["production_mwh"] > 0]["production_mwh"].iloc[0]
        non_zero_eff = df_eff[df_eff["production_mwh"] > 0]["production_mwh"].iloc[0]
        assert non_zero_eff < non_zero_raw

    def test_invalid_power_raises(self):
        with pytest.raises(ValueError):
            calculate_thermique_production(0, 20, DATE_START, DATE_END, fuel_type="Gaz naturel")

    def test_invalid_maintenance_week_raises(self):
        with pytest.raises(ValueError):
            calculate_thermique_production(500, 0, DATE_START, DATE_END, fuel_type="Gaz naturel")

    def test_invalid_date_range_raises(self):
        with pytest.raises(ValueError):
            calculate_thermique_production(500, 20, DATE_END, DATE_START, fuel_type="Gaz naturel")

    def test_invalid_fuel_type_raises(self):
        with pytest.raises(ValueError):
            calculate_thermique_production(500, 20, DATE_START, DATE_END, fuel_type="Pétrole")

    def test_all_fuel_types_accepted(self):
        for fuel in ["Gaz naturel", "Charbon", "Diesel", "Biomasse"]:
            df = calculate_thermique_production(100, 20, DATE_START, DATE_END, fuel_type=fuel)
            assert isinstance(df, pd.DataFrame)
