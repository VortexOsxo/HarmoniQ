from __future__ import annotations

from datetime import datetime
import json

import numpy as np
import pandas as pd
from scipy.stats import weibull_min

from harmoniq.modules.eolienne.weibull.turbine_selection import (
    build_economic_assumptions,
    discrete_annual_energy_kwh,
    select_best_turbine_for_point,
    weibull_speed_probabilities_by_integer_speed,
)
from harmoniq.scripts import plot_turbine_ranking_multi_criteria
from harmoniq.scripts import select_turbine_weibull


class FakeEra5Provider:
    def get_weather_point(
        self,
        latitude: float,
        longitude: float,
        start: datetime,
        end: datetime,
        tz_out: str | None = None,
    ) -> pd.DataFrame:
        index = pd.date_range(start=start, end=end, freq="h", tz="UTC")
        n = len(index)
        # Deterministic annual profile in km/h (strictly positive, realistic range).
        phase = np.linspace(0.0, 2.0 * np.pi, n, endpoint=False)
        wind_kmh = 28.0 + 12.0 * np.sin(phase) + 4.0 * np.cos(2.0 * phase)
        data = pd.DataFrame(
            {
                "latitude": np.full(n, float(latitude)),
                "longitude": np.full(n, float(longitude)),
                "temperature_C": np.full(n, 5.0),
                "vitesse_vent_kmh": wind_kmh,
                "direction_vent": np.full(n, 180.0),
            },
            index=index,
        )
        return data


def test_weibull_speed_bins_sum_to_one():
    bins = weibull_speed_probabilities_by_integer_speed(weibull_k=2.0, weibull_c=8.0)
    total_probability = float(bins["probability"].sum())
    assert np.isclose(total_probability, 1.0, atol=1e-12)


def test_weibull_final_bin_matches_tail_probability():
    k = 2.5
    c = 9.0
    bins = weibull_speed_probabilities_by_integer_speed(weibull_k=k, weibull_c=c)
    tail_expected = float(1.0 - weibull_min.cdf(25.0, k, loc=0.0, scale=c))
    tail_actual = float(bins.loc[bins["speed_m_s"] == 25, "probability"].iloc[0])
    assert np.isclose(tail_actual, tail_expected, atol=1e-12)


def test_discrete_annual_energy_matches_manual_sum():
    hours = np.array([10.0, 20.0, 30.0], dtype=float)
    power_kw = np.array([1.0, 2.0, 3.0], dtype=float)
    expected_kwh = 10.0 * 1.0 + 20.0 * 2.0 + 30.0 * 3.0
    computed_kwh = discrete_annual_energy_kwh(hours_per_speed=hours, power_kw_per_speed=power_kw)
    assert np.isclose(computed_kwh, expected_kwh)


def test_ranking_includes_models_without_real_power_curve():
    result = select_best_turbine_for_point(
        latitude=48.0,
        longitude=-68.0,
        start_year=2024,
        end_year=2024,
        min_samples=100,
        provider=FakeEra5Provider(),
    )
    ranking = pd.DataFrame(result["ranking"])
    assert "E138-4.2" in set(ranking["model_name"])
    assert "GE 2.2-107" in set(ranking["model_name"])

    row_e138 = ranking.loc[ranking["model_name"] == "E138-4.2"].iloc[0]
    row_ge22 = ranking.loc[ranking["model_name"] == "GE 2.2-107"].iloc[0]
    assert bool(row_e138["uses_real_power_curve"]) is False
    assert bool(row_ge22["uses_real_power_curve"]) is False


def test_economic_columns_and_ranks_are_present():
    result = select_best_turbine_for_point(
        latitude=48.0,
        longitude=-68.0,
        start_year=2024,
        end_year=2024,
        min_samples=100,
        provider=FakeEra5Provider(),
    )
    ranking = pd.DataFrame(result["ranking_multi_criteria"])
    required = {
        "annual_capex_amortized_cad",
        "annual_om_cost_cad",
        "om_cost_per_mwh_cad",
        "total_annual_cost_per_mwh_cad",
        "rank_energy",
        "rank_om_cost",
        "rank_total_cost",
        "rank_delta_total_vs_energy",
        "rank_delta_om_vs_energy",
    }
    assert required.issubset(ranking.columns)

    by_energy = ranking.sort_values("annual_energy_park_mwh", ascending=False).iloc[0]["model_name"]
    by_rank_energy = ranking.sort_values("rank_energy", ascending=True).iloc[0]["model_name"]
    assert by_energy == by_rank_energy


def test_economic_formula_consistency():
    result = select_best_turbine_for_point(
        latitude=48.0,
        longitude=-68.0,
        start_year=2024,
        end_year=2024,
        min_samples=100,
        provider=FakeEra5Provider(),
    )
    ranking = pd.DataFrame(result["ranking_multi_criteria"])
    assumptions = result["economic_assumptions"]

    row = ranking.iloc[0]
    expected_capex_amortized = float(row["capex_park_cad"]) / float(assumptions["project_life_years"])
    assert np.isclose(float(row["annual_capex_amortized_cad"]), expected_capex_amortized)

    expected_om = (
        float(row["annual_om_site_cost_cad"])
        + float(row["annual_om_turbine_cost_cad"])
        + float(row["annual_variable_om_cost_cad"])
    )
    assert np.isclose(float(row["annual_om_cost_cad"]), expected_om)

    expected_total_per_mwh = float(row["annual_total_cost_cad"]) / float(row["annual_energy_park_mwh"])
    assert np.isclose(float(row["total_annual_cost_per_mwh_cad"]), expected_total_per_mwh)


def test_rank_directions_and_deltas():
    result = select_best_turbine_for_point(
        latitude=48.0,
        longitude=-68.0,
        start_year=2024,
        end_year=2024,
        min_samples=100,
        provider=FakeEra5Provider(),
    )
    ranking = pd.DataFrame(result["ranking_multi_criteria"])

    best_energy = ranking.loc[ranking["annual_energy_park_mwh"].idxmax()]
    assert int(best_energy["rank_energy"]) == 1

    best_om = ranking.loc[ranking["om_cost_per_mwh_cad"].idxmin()]
    assert int(best_om["rank_om_cost"]) == 1

    best_total = ranking.loc[ranking["total_annual_cost_per_mwh_cad"].idxmin()]
    assert int(best_total["rank_total_cost"]) == 1

    assert np.all(
        ranking["rank_delta_total_vs_energy"].to_numpy(dtype=int)
        == (
            ranking["rank_total_cost"].to_numpy(dtype=int)
            - ranking["rank_energy"].to_numpy(dtype=int)
        )
    )
    assert np.all(
        ranking["rank_delta_om_vs_energy"].to_numpy(dtype=int)
        == (
            ranking["rank_om_cost"].to_numpy(dtype=int)
            - ranking["rank_energy"].to_numpy(dtype=int)
        )
    )


def test_cli_outputs_and_best_model_consistency(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "harmoniq.modules.eolienne.weibull.turbine_selection.Era5WeatherProvider",
        FakeEra5Provider,
    )

    select_turbine_weibull.main(
        [
            "--lat",
            "48.0",
            "--lon",
            "-68.0",
            "--start-year",
            "2024",
            "--end-year",
            "2024",
            "--min-samples",
            "100",
            "--output-dir",
            str(tmp_path),
        ]
    )

    wind_bins_path = tmp_path / "wind_probability_bins.csv"
    ranking_path = tmp_path / "turbine_ranking.csv"
    ranking_multi_path = tmp_path / "turbine_ranking_multi_criteria.csv"
    assumptions_path = tmp_path / "economic_assumptions.json"
    summary_path = tmp_path / "best_turbine_summary.json"
    assert wind_bins_path.exists()
    assert ranking_path.exists()
    assert ranking_multi_path.exists()
    assert assumptions_path.exists()
    assert summary_path.exists()

    ranking_df = pd.read_csv(ranking_multi_path)
    with summary_path.open("r", encoding="utf-8") as fp:
        summary = json.load(fp)
    best_model_name = summary["best_by_energy"]["model_name"]
    max_model_name = ranking_df.sort_values("annual_energy_park_mwh", ascending=False).iloc[0]["model_name"]
    assert best_model_name == max_model_name

    with assumptions_path.open("r", encoding="utf-8") as fp:
        assumptions = json.load(fp)
    assert assumptions["scenario"] == "cer_2026_current"


def test_ranking_order_is_independent_from_price_per_mw():
    provider = FakeEra5Provider()
    low_price = select_best_turbine_for_point(
        latitude=48.0,
        longitude=-68.0,
        start_year=2024,
        end_year=2024,
        park_mw=200.0,
        price_per_mw=1_000_000.0,
        min_samples=100,
        provider=provider,
    )
    high_price = select_best_turbine_for_point(
        latitude=48.0,
        longitude=-68.0,
        start_year=2024,
        end_year=2024,
        park_mw=200.0,
        price_per_mw=5_000_000.0,
        min_samples=100,
        provider=provider,
    )

    rank_low = pd.DataFrame(low_price["ranking"])
    rank_high = pd.DataFrame(high_price["ranking"])
    assert rank_low["model_name"].tolist() == rank_high["model_name"].tolist()
    assert np.allclose(
        rank_low["annual_energy_park_mwh"].to_numpy(dtype=float),
        rank_high["annual_energy_park_mwh"].to_numpy(dtype=float),
    )


def test_build_economic_assumptions_override_life():
    assumptions = build_economic_assumptions(project_life_years=30)
    assert assumptions.project_life_years == 30


def test_multi_criteria_plot_script_generation(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "harmoniq.modules.eolienne.weibull.turbine_selection.Era5WeatherProvider",
        FakeEra5Provider,
    )
    select_turbine_weibull.main(
        [
            "--lat",
            "48.0",
            "--lon",
            "-68.0",
            "--start-year",
            "2024",
            "--end-year",
            "2024",
            "--min-samples",
            "100",
            "--output-dir",
            str(tmp_path),
        ]
    )
    ranking_multi_path = tmp_path / "turbine_ranking_multi_criteria.csv"
    output_png = tmp_path / "turbine_ranking_multi_criteria.png"

    plot_turbine_ranking_multi_criteria.main(
        [
            "--ranking-csv",
            str(ranking_multi_path),
            "--output-png",
            str(output_png),
        ]
    )
    assert output_png.exists()
