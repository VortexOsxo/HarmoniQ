from __future__ import annotations

import argparse
from pathlib import Path

from harmoniq import PROJECT_ROOT
from harmoniq.modules.eolienne.weibull.turbine_selection import (
    DEFAULT_ECONOMIC_SCENARIO,
    DEFAULT_END_YEAR,
    DEFAULT_MIN_SAMPLES,
    DEFAULT_PARK_MW,
    DEFAULT_PRICE_PER_MW,
    DEFAULT_START_YEAR,
    export_turbine_selection_outputs,
    select_best_turbine_for_point,
)


def _default_output_dir() -> Path:
    return PROJECT_ROOT / "harmoniq" / "modules" / "eolienne" / "plot" / "turbine_selection_weibull"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Select the best wind turbine model at a Quebec point using Weibull annual "
            "probabilities (integer wind-speed bins 0..25 m/s)."
        )
    )
    parser.add_argument("--lat", type=float, required=True, help="Latitude of the point")
    parser.add_argument("--lon", type=float, required=True, help="Longitude of the point")
    parser.add_argument(
        "--start-year",
        type=int,
        default=DEFAULT_START_YEAR,
        help="First ERA5 year for Weibull fit (inclusive)",
    )
    parser.add_argument(
        "--end-year",
        type=int,
        default=DEFAULT_END_YEAR,
        help="Last ERA5 year for Weibull fit (inclusive)",
    )
    parser.add_argument(
        "--park-mw",
        type=float,
        default=DEFAULT_PARK_MW,
        help="Standard installed park nominal power in MW",
    )
    parser.add_argument(
        "--price-per-mw",
        type=float,
        default=DEFAULT_PRICE_PER_MW,
        help="Hypothetical nominal power cost in $/MW",
    )
    parser.add_argument(
        "--min-samples",
        type=int,
        default=DEFAULT_MIN_SAMPLES,
        help="Minimum positive wind samples required for Weibull fit",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=_default_output_dir(),
        help="Folder where output CSV/JSON files are written",
    )
    parser.add_argument(
        "--economic-scenario",
        type=str,
        default=DEFAULT_ECONOMIC_SCENARIO,
        help="Economic assumptions scenario (default: cer_2026_current)",
    )
    parser.add_argument(
        "--project-life-years",
        type=int,
        default=None,
        help="Override project life used for annualized CAPEX (years)",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    result = select_best_turbine_for_point(
        latitude=float(args.lat),
        longitude=float(args.lon),
        start_year=int(args.start_year),
        end_year=int(args.end_year),
        park_mw=float(args.park_mw),
        price_per_mw=float(args.price_per_mw),
        min_samples=int(args.min_samples),
        economic_scenario=str(args.economic_scenario),
        project_life_years=args.project_life_years,
    )
    outputs = export_turbine_selection_outputs(result=result, output_dir=args.output_dir)
    best_energy = result["best_by_energy"]
    best_cost = result["best_by_total_cost"]
    fit = result["weibull_fit"]

    print("----- Turbine Selection Weibull -----")
    print(f"Point: lat={args.lat:.6f}, lon={args.lon:.6f}")
    print(f"Weibull fit: k={fit['k']:.6f}, c={fit['c']:.6f}, samples={fit['sample_count']}, method={fit['method']}")
    print(f"Best model by energy: {best_energy['model_name']}")
    print(f"Best annual energy (park): {best_energy['annual_energy_park_mwh']:.2f} MWh")
    print(f"Best model by total annualized cost: {best_cost['model_name']}")
    print(
        "Best total annualized cost metric: "
        f"{best_cost['total_annual_cost_per_mwh_cad']:.2f} C$/MWh"
    )
    print(f"wind_probability_bins.csv: {outputs['wind_probability_bins']}")
    print(f"turbine_ranking.csv: {outputs['turbine_ranking']}")
    print(f"turbine_ranking_multi_criteria.csv: {outputs['turbine_ranking_multi_criteria']}")
    print(f"economic_assumptions.json: {outputs['economic_assumptions']}")
    print(f"best_turbine_summary.json: {outputs['best_turbine_summary']}")


if __name__ == "__main__":
    main()
