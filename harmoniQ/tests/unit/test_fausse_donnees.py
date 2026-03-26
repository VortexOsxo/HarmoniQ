import numpy as np
import pandas as pd
import pytest
from datetime import datetime, timedelta

from harmoniq.core.fausse_données import scenario_to_range, production_aleatoire
from harmoniq.db.schemas import ScenarioBase, Weather, Consomation


@pytest.fixture
def hourly_scenario():
    return ScenarioBase(
        nom="Horaire",
        date_de_debut=datetime(2024, 1, 1),
        date_de_fin=datetime(2024, 1, 7),
        pas_de_temps=timedelta(hours=1),
        weather=Weather.typical,
        consomation=Consomation.PV,
    )


@pytest.fixture
def daily_scenario():
    return ScenarioBase(
        nom="Journalier",
        date_de_debut=datetime(2024, 1, 1),
        date_de_fin=datetime(2024, 1, 31),
        pas_de_temps=timedelta(days=1),
        weather=Weather.warm,
        consomation=Consomation.UB,
    )


@pytest.fixture
def single_point_scenario():
    return ScenarioBase(
        nom="Point",
        date_de_debut=datetime(2024, 6, 1),
        date_de_fin=datetime(2024, 6, 1),
        pas_de_temps=timedelta(hours=1),
    )


class TestScenarioToRange:
    def test_returns_datetimeindex(self, hourly_scenario):
        result = scenario_to_range(hourly_scenario)
        assert isinstance(result, pd.DatetimeIndex)

    def test_hourly_frequency_count(self, hourly_scenario):
        result = scenario_to_range(hourly_scenario)
        assert len(result) == 145

    def test_daily_frequency_count(self, daily_scenario):
        result = scenario_to_range(daily_scenario)
        assert len(result) == 31

    def test_start_matches_scenario(self, hourly_scenario):
        result = scenario_to_range(hourly_scenario)
        assert result[0] == pd.Timestamp(hourly_scenario.date_de_debut)

    def test_end_matches_scenario(self, hourly_scenario):
        result = scenario_to_range(hourly_scenario)
        assert result[-1] == pd.Timestamp(hourly_scenario.date_de_fin)

    def test_single_point_scenario(self, single_point_scenario):
        result = scenario_to_range(single_point_scenario)
        assert len(result) == 1

    def test_step_matches_pas_de_temps(self, hourly_scenario):
        result = scenario_to_range(hourly_scenario)
        diffs = result.to_series().diff().dropna().unique()
        assert len(diffs) == 1
        assert diffs[0] == pd.Timedelta(hourly_scenario.pas_de_temps)

    def test_daily_step_matches(self, daily_scenario):
        result = scenario_to_range(daily_scenario)
        diffs = result.to_series().diff().dropna().unique()
        assert diffs[0] == pd.Timedelta(daily_scenario.pas_de_temps)


class TestProductionAleatoire:
    def test_returns_dataframe(self, hourly_scenario):
        result = production_aleatoire(hourly_scenario)
        assert isinstance(result, pd.DataFrame)

    def test_has_temps_and_production_columns(self, hourly_scenario):
        result = production_aleatoire(hourly_scenario)
        assert "temps" in result.columns
        assert "production" in result.columns

    def test_row_count_matches_scenario_range(self, hourly_scenario):
        expected_len = len(scenario_to_range(hourly_scenario))
        result = production_aleatoire(hourly_scenario)
        assert len(result) == expected_len

    def test_temps_column_is_datetimes(self, hourly_scenario):
        result = production_aleatoire(hourly_scenario)
        assert pd.api.types.is_datetime64_any_dtype(result["temps"])

    def test_production_values_are_numeric(self, hourly_scenario):
        result = production_aleatoire(hourly_scenario)
        assert pd.api.types.is_numeric_dtype(result["production"])

    def test_production_is_non_negative(self, hourly_scenario):
        np.random.seed(0)
        result = production_aleatoire(hourly_scenario)
        positive_fraction = (result["production"] > 0).mean()
        assert positive_fraction > 0.95

    def test_daily_scenario_runs_without_error(self, daily_scenario):
        result = production_aleatoire(daily_scenario)
        assert len(result) == len(scenario_to_range(daily_scenario))

    def test_two_calls_differ_due_to_randomness(self, hourly_scenario):
        r1 = production_aleatoire(hourly_scenario)
        r2 = production_aleatoire(hourly_scenario)
        assert not r1["production"].equals(r2["production"])
