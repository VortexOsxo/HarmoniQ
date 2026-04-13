import pytest
import pandas as pd
from datetime import datetime

from harmoniq.modules.thermique.calculs_production_thermique import (
    calculate_thermique_production,
)
from harmoniq.modules.nucleaire.calculs_production_nucleaire import (
    calculate_nuclear_production,
    co2_emissions_nuclear,
    cost_nuclear_powerplant,
)


def _date(year, month, day):
    return datetime(year, month, day)


class TestCalculateThermiqueProduction:
    def test_returns_dataframe(self):
        start, end = _date(2024, 1, 1), _date(2024, 1, 3)
        result = calculate_thermique_production(100.0, maintenance_week=10, date_start=start, date_end=end)
        assert isinstance(result, pd.DataFrame)

    def test_has_production_mwh_column(self):
        start, end = _date(2024, 1, 1), _date(2024, 1, 7)
        result = calculate_thermique_production(200.0, maintenance_week=15, date_start=start, date_end=end)
        assert "production_mwh" in result.columns

    def test_index_is_hourly(self):
        start, end = _date(2024, 1, 1), _date(2024, 1, 3)
        result = calculate_thermique_production(100.0, maintenance_week=10, date_start=start, date_end=end)
        diffs = result.index.to_series().diff().dropna().unique()
        assert len(diffs) == 1
        assert diffs[0] == pd.Timedelta("1h")

    def test_constant_power_outside_maintenance(self):
        power = 400.0
        start, end = _date(2024, 1, 1), _date(2024, 1, 14)
        result = calculate_thermique_production(power, maintenance_week=50, date_start=start, date_end=end)
        assert (result["production_mwh"] == power).all()

    def test_maintenance_week_produces_zero(self):
        power = 300.0
        start, end = _date(2024, 1, 1), _date(2024, 1, 14)
        result = calculate_thermique_production(power, maintenance_week=1, date_start=start, date_end=end)
        assert (result["production_mwh"] == 0).any()
        assert (result["production_mwh"] == power).any()

    def test_maintenance_zeros_span_exactly_one_week(self):
        power = 500.0
        start, end = _date(2024, 1, 1), _date(2024, 12, 31)
        result = calculate_thermique_production(power, maintenance_week=20, date_start=start, date_end=end)
        zero_hours = (result["production_mwh"] == 0).sum()
        assert zero_hours == 168

    def test_zero_power_raises_value_error(self):
        start, end = _date(2024, 3, 1), _date(2024, 3, 7)
        with pytest.raises(ValueError):
            calculate_thermique_production(0.0, maintenance_week=5, date_start=start, date_end=end)


class TestCalculateNuclearProduction:
    def test_returns_dataframe(self):
        result = calculate_nuclear_production(300.0, maintenance_week=20,
                                              date_start=_date(2024, 1, 1),
                                              date_end=_date(2024, 1, 7))
        assert isinstance(result, pd.DataFrame)

    def test_has_production_mwh_column(self):
        result = calculate_nuclear_production(300.0, maintenance_week=20,
                                              date_start=_date(2024, 1, 1),
                                              date_end=_date(2024, 1, 7))
        assert "production_mwh" in result.columns

    def test_constant_outside_maintenance(self):
        power = 1200.0
        result = calculate_nuclear_production(power, maintenance_week=50,
                                              date_start=_date(2024, 1, 1),
                                              date_end=_date(2024, 1, 14))
        assert (result["production_mwh"] == power).all()

    def test_maintenance_week_is_zero(self):
        power = 600.0
        result = calculate_nuclear_production(power, maintenance_week=1,
                                              date_start=_date(2024, 1, 1),
                                              date_end=_date(2024, 1, 14))
        assert (result["production_mwh"] == 0).any()

    def test_maintenance_zeros_exactly_168_hours(self):
        result = calculate_nuclear_production(300.0, maintenance_week=10,
                                              date_start=_date(2024, 1, 1),
                                              date_end=_date(2024, 12, 31))
        zero_hours = (result["production_mwh"] == 0).sum()
        assert zero_hours == 168


class TestCo2EmissionsNuclear:
    def test_default_emission_factor(self):
        result = co2_emissions_nuclear(1_000_000)
        assert result == pytest.approx(8_000.0)

    def test_custom_emission_factor(self):
        result = co2_emissions_nuclear(500.0, facteur_emission=10)
        assert result == pytest.approx(5.0)

    def test_zero_production_zero_emissions(self):
        assert co2_emissions_nuclear(0.0) == 0.0

    def test_linearity(self):
        e1 = co2_emissions_nuclear(1000.0)
        e2 = co2_emissions_nuclear(2000.0)
        assert e2 == pytest.approx(2 * e1)

    def test_returns_kg_not_grams(self):
        result = co2_emissions_nuclear(1000.0)
        assert result == pytest.approx(8.0)


class TestCostNuclearPowerplant:
    def test_positive_cost_for_positive_power(self):
        assert cost_nuclear_powerplant(300.0) > 0

    def test_larger_plant_costs_more(self):
        cost_small = cost_nuclear_powerplant(100.0)
        cost_large = cost_nuclear_powerplant(1000.0)
        assert cost_large > cost_small

    def test_linear_scaling(self):
        cost_300 = cost_nuclear_powerplant(300.0)
        cost_1200 = cost_nuclear_powerplant(1200.0)
        ratio = cost_1200 / cost_300
        assert ratio == pytest.approx(4.0)

    def test_formula_matches_manual_calculation(self):
        power = 500.0
        expected = power * 10_000_000
        assert cost_nuclear_powerplant(power) == pytest.approx(expected)

    def test_zero_power_returns_zero(self):
        assert cost_nuclear_powerplant(0.0) == pytest.approx(0.0)
