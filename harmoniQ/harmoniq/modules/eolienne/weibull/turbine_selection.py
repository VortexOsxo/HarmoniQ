from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import weibull_min

from harmoniq.core.meteo_era5 import Era5WeatherProvider
from harmoniq.modules.eolienne.turbine_data import turbine_models
from harmoniq.modules.eolienne.weibull.Weibull_calcule import (
    build_turbine_power_curve,
    drop_feb29_from_index,
    estimate_weibull_coefficients,
)

DEFAULT_START_YEAR = 2015
DEFAULT_END_YEAR = 2024
DEFAULT_MIN_SAMPLES = 500
DEFAULT_HOURS_PER_YEAR = 8760.0
DEFAULT_PARK_MW = 200.0
DEFAULT_PRICE_PER_MW = 2_600_000.0
DEFAULT_ECONOMIC_SCENARIO = "cer_2026_current"
DEFAULT_PROJECT_LIFE_YEARS = 25
WIND_REFERENCE_HEIGHT_M = 100.0


@dataclass(frozen=True)
class EconomicAssumptions:
    scenario: str
    currency: str
    capex_cad_per_kw: float
    project_life_years: int
    fom_ratio: float
    vom_cad_per_mwh: float
    om_turbine_share: float
    om_site_share: float
    n_ref_turbines: float
    capex_reference_source: str
    om_reference_source: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_economic_assumptions(
    economic_scenario: str = DEFAULT_ECONOMIC_SCENARIO,
    project_life_years: int | None = None,
) -> EconomicAssumptions:
    scenario = str(economic_scenario).strip().lower()
    if scenario != DEFAULT_ECONOMIC_SCENARIO:
        raise ValueError(
            f"Unsupported economic_scenario={economic_scenario!r}. "
            f"Expected {DEFAULT_ECONOMIC_SCENARIO!r}."
        )

    life_years = int(project_life_years) if project_life_years is not None else DEFAULT_PROJECT_LIFE_YEARS
    if life_years <= 0:
        raise ValueError("project_life_years must be > 0")

    fom_ratio = 33.06 / 1489.0
    om_turbine_share = (2.24 + 2.80) / 6.6112
    om_site_share = 1.0 - om_turbine_share
    if om_turbine_share <= 0 or om_site_share <= 0:
        raise ValueError("Invalid O&M share decomposition")

    return EconomicAssumptions(
        scenario=DEFAULT_ECONOMIC_SCENARIO,
        currency="C$2025",
        capex_cad_per_kw=1994.0,
        project_life_years=life_years,
        fom_ratio=float(fom_ratio),
        vom_cad_per_mwh=0.0,
        om_turbine_share=float(om_turbine_share),
        om_site_share=float(om_site_share),
        n_ref_turbines=float(200.0 / 2.8),
        capex_reference_source="CER EF2026 Appendix 2 (onshore wind 2024: 1,994 C$2025/kW)",
        om_reference_source="EIA 2024 Case 13 (FOM 33.06 $/kW-yr and O&M decomposition)",
    )


def weibull_speed_probabilities_by_integer_speed(
    weibull_k: float,
    weibull_c: float,
    hours_per_year: float = DEFAULT_HOURS_PER_YEAR,
) -> pd.DataFrame:
    """
    Build annual Weibull probabilities for speed bins in m/s:
    - bins 0..24 map to [v, v+1)
    - bin 25 maps to [25, +inf)
    """
    if weibull_k <= 0 or weibull_c <= 0:
        raise ValueError("Invalid Weibull parameters: k and c must be > 0")
    if hours_per_year <= 0:
        raise ValueError("hours_per_year must be > 0")

    speeds = np.arange(0, 26, dtype=float)
    cdf_at_edges = weibull_min.cdf(speeds, weibull_k, loc=0.0, scale=weibull_c)
    probabilities = np.empty(26, dtype=float)
    probabilities[:25] = np.diff(cdf_at_edges)
    probabilities[25] = 1.0 - cdf_at_edges[-1]

    probabilities = np.clip(probabilities, 0.0, 1.0)
    total = float(probabilities.sum())
    if not np.isfinite(total) or total <= 0:
        raise ValueError("Computed invalid Weibull bin probabilities")
    probabilities = probabilities / total

    hours = probabilities * float(hours_per_year)
    labels = [f"[{int(v)},{int(v) + 1})" for v in speeds[:25]] + ["[25,+inf)"]
    return pd.DataFrame(
        {
            "speed_m_s": speeds.astype(int),
            "speed_bin": labels,
            "probability": probabilities,
            "probability_pct": probabilities * 100.0,
            "hours_per_year": hours,
        }
    )


def discrete_annual_energy_kwh(
    hours_per_speed: np.ndarray,
    power_kw_per_speed: np.ndarray,
) -> float:
    """
    Compute annual energy from discrete bins:
      E = sum(hours_v * P(v))
    """
    hours = np.asarray(hours_per_speed, dtype=float)
    power_kw = np.asarray(power_kw_per_speed, dtype=float)
    if hours.shape != power_kw.shape:
        raise ValueError("hours_per_speed and power_kw_per_speed must have the same shape")
    if hours.ndim != 1:
        raise ValueError("Discrete energy expects 1D arrays")
    if np.any(~np.isfinite(hours)) or np.any(~np.isfinite(power_kw)):
        raise ValueError("hours_per_speed and power_kw_per_speed must be finite")
    if np.any(hours < 0):
        raise ValueError("hours_per_speed must be >= 0")
    return float(np.sum(hours * power_kw))


def infer_rated_power_kw(model_name: str, turbine_data: dict) -> float:
    explicit = turbine_data.get("rated_power_kw")
    if explicit is not None:
        rated_kw = float(explicit)
        if np.isfinite(rated_kw) and rated_kw > 0:
            return rated_kw

    curve = turbine_data.get("power_curve")
    if isinstance(curve, pd.DataFrame) and "power" in curve.columns:
        power_values = pd.to_numeric(curve["power"], errors="coerce").to_numpy(dtype=float)
        if power_values.size > 0:
            max_power_w = float(np.nanmax(power_values))
            rated_kw = max_power_w / 1000.0
            if np.isfinite(rated_kw) and rated_kw > 0:
                return rated_kw

    raise ValueError(
        f"Unable to infer rated power for turbine model '{model_name}'. "
        "Provide rated_power_kw or a valid power_curve."
    )


def _year_range(start_year: int, end_year: int) -> list[int]:
    if end_year < start_year:
        raise ValueError(f"Invalid year interval: start_year={start_year} end_year={end_year}")
    return list(range(start_year, end_year + 1))


def load_era5_wind_samples_ms(
    latitude: float,
    longitude: float,
    start_year: int = DEFAULT_START_YEAR,
    end_year: int = DEFAULT_END_YEAR,
    provider: Era5WeatherProvider | None = None,
) -> np.ndarray:
    service = provider or Era5WeatherProvider()
    years = _year_range(start_year=start_year, end_year=end_year)
    all_samples: list[np.ndarray] = []

    for year in years:
        start = datetime(year, 1, 1, 0, 0, 0)
        end = datetime(year, 12, 31, 23, 0, 0)
        meteo = service.get_weather_point(
            latitude=float(latitude),
            longitude=float(longitude),
            start=start,
            end=end,
            tz_out="UTC",
        ).copy()
        if meteo.empty:
            continue

        meteo.index = pd.to_datetime(meteo.index, utc=True).tz_localize(None)
        meteo = drop_feb29_from_index(meteo)
        wind_ms = pd.to_numeric(meteo["vitesse_vent_kmh"], errors="coerce").to_numpy(dtype=float) / 3.6
        all_samples.append(wind_ms)

    if not all_samples:
        raise ValueError(
            f"No ERA5 wind samples available for lat={latitude}, lon={longitude}, "
            f"years={start_year}-{end_year}"
        )

    samples = np.concatenate(all_samples)
    samples = samples[np.isfinite(samples)]
    samples = samples[samples > 0.0]
    if samples.size == 0:
        raise ValueError("No valid positive wind samples available after filtering")
    return samples


def _rank_from_column(df: pd.DataFrame, column: str, ascending: bool) -> np.ndarray:
    sorted_index = df.sort_values([column, "model_name"], ascending=[ascending, True], kind="mergesort").index
    out = np.empty(len(df), dtype=int)
    out[sorted_index.to_numpy(dtype=int)] = np.arange(1, len(df) + 1, dtype=int)
    return out


def _build_turbine_ranking(
    wind_bins: pd.DataFrame,
    park_mw: float,
    price_per_mw: float,
    economic_assumptions: EconomicAssumptions,
    include_fallback_models: bool = True,
) -> pd.DataFrame:
    if park_mw <= 0:
        raise ValueError("park_mw must be > 0")
    if price_per_mw < 0:
        raise ValueError("price_per_mw must be >= 0")

    speeds = wind_bins["speed_m_s"].to_numpy(dtype=float)
    hours = wind_bins["hours_per_year"].to_numpy(dtype=float)
    park_kw = float(park_mw) * 1000.0
    park_nominal_power_cost = float(park_mw) * float(price_per_mw)

    capex_park_cad = float(economic_assumptions.capex_cad_per_kw) * park_kw
    annual_capex_amortized_cad = capex_park_cad / float(economic_assumptions.project_life_years)
    annual_fom_total_cad = float(economic_assumptions.fom_ratio) * capex_park_cad
    annual_om_site_cost_cad = annual_fom_total_cad * float(economic_assumptions.om_site_share)
    n_ref_turbines = float(economic_assumptions.n_ref_turbines)

    rows: list[dict[str, Any]] = []
    for model_name, model_data in turbine_models.items():
        has_real_curve = isinstance(model_data.get("power_curve"), pd.DataFrame)
        if not include_fallback_models and not has_real_curve:
            continue

        rated_power_kw = infer_rated_power_kw(model_name, model_data)
        power_kw_per_speed = build_turbine_power_curve(
            v_grid=speeds,
            turbine_data=model_data,
            rated_power_kw=rated_power_kw,
            prefer_real_power_curve=True,
        )
        annual_energy_turbine_kwh = discrete_annual_energy_kwh(
            hours_per_speed=hours,
            power_kw_per_speed=power_kw_per_speed,
        )
        annual_energy_turbine_mwh = annual_energy_turbine_kwh / 1000.0

        equivalent_turbine_count = park_kw / rated_power_kw
        annual_energy_park_kwh = annual_energy_turbine_kwh * equivalent_turbine_count
        annual_energy_park_mwh = annual_energy_park_kwh / 1000.0

        nominal_power_cost_of_the_turbine = (rated_power_kw / 1000.0) * float(price_per_mw)
        park_nominal_cost_per_mwh = (
            park_nominal_power_cost / annual_energy_park_mwh if annual_energy_park_mwh > 0 else float("inf")
        )

        annual_om_turbine_cost_cad = (
            annual_fom_total_cad
            * float(economic_assumptions.om_turbine_share)
            * (equivalent_turbine_count / n_ref_turbines)
        )
        annual_variable_om_cost_cad = float(economic_assumptions.vom_cad_per_mwh) * annual_energy_park_mwh
        annual_om_cost_cad = annual_om_site_cost_cad + annual_om_turbine_cost_cad + annual_variable_om_cost_cad
        annual_total_cost_cad = annual_capex_amortized_cad + annual_om_cost_cad

        om_cost_per_mwh_cad = annual_om_cost_cad / annual_energy_park_mwh if annual_energy_park_mwh > 0 else float("inf")
        total_annual_cost_per_mwh_cad = (
            annual_total_cost_cad / annual_energy_park_mwh if annual_energy_park_mwh > 0 else float("inf")
        )

        rows.append(
            {
                "model_name": model_name,
                "uses_real_power_curve": bool(has_real_curve),
                "rated_power_kw": float(rated_power_kw),
                "rated_power_mw": float(rated_power_kw / 1000.0),
                "equivalent_turbine_count": float(equivalent_turbine_count),
                "annual_energy_turbine_kwh": float(annual_energy_turbine_kwh),
                "annual_energy_turbine_mwh": float(annual_energy_turbine_mwh),
                "annual_energy_park_kwh": float(annual_energy_park_kwh),
                "annual_energy_park_mwh": float(annual_energy_park_mwh),
                "nominal_power_cost_of_the_turbine": float(nominal_power_cost_of_the_turbine),
                "park_nominal_power_cost": float(park_nominal_power_cost),
                "park_nominal_cost_per_mwh": float(park_nominal_cost_per_mwh),
                "capex_park_cad": float(capex_park_cad),
                "annual_capex_amortized_cad": float(annual_capex_amortized_cad),
                "annual_om_site_cost_cad": float(annual_om_site_cost_cad),
                "annual_om_turbine_cost_cad": float(annual_om_turbine_cost_cad),
                "annual_variable_om_cost_cad": float(annual_variable_om_cost_cad),
                "annual_om_cost_cad": float(annual_om_cost_cad),
                "annual_total_cost_cad": float(annual_total_cost_cad),
                "om_cost_per_mwh_cad": float(om_cost_per_mwh_cad),
                "total_annual_cost_per_mwh_cad": float(total_annual_cost_per_mwh_cad),
            }
        )

    ranking = pd.DataFrame(rows)
    if ranking.empty:
        return ranking

    ranking["rank_energy"] = _rank_from_column(ranking, column="annual_energy_park_mwh", ascending=False)
    ranking["rank_om_cost"] = _rank_from_column(ranking, column="om_cost_per_mwh_cad", ascending=True)
    ranking["rank_total_cost"] = _rank_from_column(ranking, column="total_annual_cost_per_mwh_cad", ascending=True)
    ranking["rank_delta_total_vs_energy"] = ranking["rank_total_cost"] - ranking["rank_energy"]
    ranking["rank_delta_om_vs_energy"] = ranking["rank_om_cost"] - ranking["rank_energy"]

    # Legacy rank kept for backward compatibility.
    ranking["rank"] = ranking["rank_energy"].astype(int)

    ranking = ranking.sort_values(
        by=["rank_energy", "annual_energy_turbine_mwh", "model_name"],
        ascending=[True, False, True],
        kind="mergesort",
    ).reset_index(drop=True)

    ordered_cols = [
        "rank",
        "rank_energy",
        "rank_om_cost",
        "rank_total_cost",
        "rank_delta_total_vs_energy",
        "rank_delta_om_vs_energy",
        "model_name",
        "uses_real_power_curve",
        "rated_power_kw",
        "rated_power_mw",
        "equivalent_turbine_count",
        "annual_energy_turbine_kwh",
        "annual_energy_turbine_mwh",
        "annual_energy_park_kwh",
        "annual_energy_park_mwh",
        "nominal_power_cost_of_the_turbine",
        "park_nominal_power_cost",
        "park_nominal_cost_per_mwh",
        "capex_park_cad",
        "annual_capex_amortized_cad",
        "annual_om_site_cost_cad",
        "annual_om_turbine_cost_cad",
        "annual_variable_om_cost_cad",
        "annual_om_cost_cad",
        "annual_total_cost_cad",
        "om_cost_per_mwh_cad",
        "total_annual_cost_per_mwh_cad",
    ]
    return ranking[ordered_cols]


def select_best_turbine_from_wind_samples(
    wind_samples_ms: np.ndarray,
    park_mw: float = DEFAULT_PARK_MW,
    price_per_mw: float = DEFAULT_PRICE_PER_MW,
    min_samples: int = DEFAULT_MIN_SAMPLES,
    include_fallback_models: bool = True,
    economic_scenario: str = DEFAULT_ECONOMIC_SCENARIO,
    project_life_years: int | None = None,
    input_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    economic_assumptions = build_economic_assumptions(
        economic_scenario=economic_scenario,
        project_life_years=project_life_years,
    )
    samples = np.asarray(wind_samples_ms, dtype=float)
    samples = samples[np.isfinite(samples)]
    samples = samples[samples > 0.0]
    if samples.size == 0:
        raise ValueError("No valid positive wind samples available after filtering")

    weibull_k, weibull_c, sample_count, method = estimate_weibull_coefficients(
        samples,
        min_samples=min_samples,
    )
    wind_bins = weibull_speed_probabilities_by_integer_speed(weibull_k=weibull_k, weibull_c=weibull_c)
    ranking = _build_turbine_ranking(
        wind_bins=wind_bins,
        park_mw=park_mw,
        price_per_mw=price_per_mw,
        economic_assumptions=economic_assumptions,
        include_fallback_models=include_fallback_models,
    )
    if ranking.empty:
        raise ValueError("No turbine model available for ranking")

    best_by_energy = ranking.sort_values(
        ["rank_energy", "annual_energy_park_mwh", "model_name"],
        ascending=[True, False, True],
        kind="mergesort",
    ).iloc[0].to_dict()
    best_by_total_cost = ranking.sort_values(
        ["rank_total_cost", "total_annual_cost_per_mwh_cad", "model_name"],
        ascending=[True, True, True],
        kind="mergesort",
    ).iloc[0].to_dict()
    ranking_records = ranking.to_dict(orient="records")

    base_input = {
        "wind_reference_height_m": float(WIND_REFERENCE_HEIGHT_M),
        "park_mw": float(park_mw),
        "price_per_mw": float(price_per_mw),
        "min_samples": int(min_samples),
        "hours_per_year": float(DEFAULT_HOURS_PER_YEAR),
        "economic_scenario": str(economic_assumptions.scenario),
        "project_life_years": int(economic_assumptions.project_life_years),
    }
    if isinstance(input_context, dict):
        base_input.update(input_context)

    result = {
        "input": base_input,
        "weibull_fit": {
            "k": float(weibull_k),
            "c": float(weibull_c),
            "sample_count": int(sample_count),
            "method": str(method),
        },
        "economic_assumptions": economic_assumptions.to_dict(),
        "wind_bins": wind_bins.to_dict(orient="records"),
        "ranking": ranking_records,
        "ranking_multi_criteria": ranking_records,
        "best_model": best_by_energy,
        "best_by_energy": best_by_energy,
        "best_by_total_cost": best_by_total_cost,
    }
    return result


def select_best_turbine_for_point(
    latitude: float,
    longitude: float,
    start_year: int = DEFAULT_START_YEAR,
    end_year: int = DEFAULT_END_YEAR,
    park_mw: float = DEFAULT_PARK_MW,
    price_per_mw: float = DEFAULT_PRICE_PER_MW,
    min_samples: int = DEFAULT_MIN_SAMPLES,
    provider: Era5WeatherProvider | None = None,
    include_fallback_models: bool = True,
    economic_scenario: str = DEFAULT_ECONOMIC_SCENARIO,
    project_life_years: int | None = None,
) -> dict[str, Any]:
    samples_ms = load_era5_wind_samples_ms(
        latitude=latitude,
        longitude=longitude,
        start_year=start_year,
        end_year=end_year,
        provider=provider,
    )
    input_context = {
        "latitude": float(latitude),
        "longitude": float(longitude),
        "start_year": int(start_year),
        "end_year": int(end_year),
    }
    return select_best_turbine_from_wind_samples(
        wind_samples_ms=samples_ms,
        park_mw=park_mw,
        price_per_mw=price_per_mw,
        min_samples=min_samples,
        include_fallback_models=include_fallback_models,
        economic_scenario=economic_scenario,
        project_life_years=project_life_years,
        input_context=input_context,
    )


def _to_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, tuple):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    return value


def export_turbine_selection_outputs(
    result: dict[str, Any],
    output_dir: str | Path,
) -> dict[str, Path]:
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    wind_bins_path = out_dir / "wind_probability_bins.csv"
    ranking_path = out_dir / "turbine_ranking.csv"
    ranking_multi_path = out_dir / "turbine_ranking_multi_criteria.csv"
    assumptions_path = out_dir / "economic_assumptions.json"
    summary_path = out_dir / "best_turbine_summary.json"

    pd.DataFrame(result["wind_bins"]).to_csv(wind_bins_path, index=False, encoding="utf-8")
    ranking_df = pd.DataFrame(result["ranking"])
    ranking_df.to_csv(ranking_path, index=False, encoding="utf-8")
    pd.DataFrame(result["ranking_multi_criteria"]).to_csv(ranking_multi_path, index=False, encoding="utf-8")

    with assumptions_path.open("w", encoding="utf-8") as fp:
        json.dump(_to_jsonable(result["economic_assumptions"]), fp, ensure_ascii=True, indent=2)

    summary_payload = {
        "input": result["input"],
        "weibull_fit": result["weibull_fit"],
        "economic_assumptions": result["economic_assumptions"],
        "best_model": result["best_model"],
        "best_by_energy": result["best_by_energy"],
        "best_by_total_cost": result["best_by_total_cost"],
    }
    with summary_path.open("w", encoding="utf-8") as fp:
        json.dump(_to_jsonable(summary_payload), fp, ensure_ascii=True, indent=2)

    return {
        "wind_probability_bins": wind_bins_path,
        "turbine_ranking": ranking_path,
        "turbine_ranking_multi_criteria": ranking_multi_path,
        "economic_assumptions": assumptions_path,
        "best_turbine_summary": summary_path,
    }
