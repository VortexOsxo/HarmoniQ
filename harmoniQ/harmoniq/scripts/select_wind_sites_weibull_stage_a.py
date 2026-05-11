from __future__ import annotations

import argparse
import logging
from pathlib import Path

from harmoniq import PROJECT_ROOT
from harmoniq.modules.eolienne.weibull.site_screening_stage_a import (
    DEFAULT_STAGE_A_BBOX_NWSE,
    DEFAULT_STAGE_A_MESH_KM,
    DEFAULT_STAGE_A_TOP_N,
    SiteScreeningStageAConfig,
    export_site_screening_stage_a_outputs,
    run_site_screening_stage_a,
)
from harmoniq.modules.eolienne.weibull.turbine_selection import (
    DEFAULT_ECONOMIC_SCENARIO,
    DEFAULT_END_YEAR,
    DEFAULT_MIN_SAMPLES,
    DEFAULT_PARK_MW,
    DEFAULT_PRICE_PER_MW,
    DEFAULT_START_YEAR,
)


def _default_output_dir() -> Path:
    return PROJECT_ROOT / "harmoniq" / "modules" / "eolienne" / "plot" / "site_screening_stage_a"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Stage A screening: evaluate a 20 km mesh over Quebec (ERA5 bbox), map points "
            "to ERA5 floor cells, compute Weibull+turbine ranking by cell, and output top sites."
        )
    )
    parser.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR, help="First ERA5 year (inclusive)")
    parser.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR, help="Last ERA5 year (inclusive)")
    parser.add_argument(
        "--mesh-km",
        type=float,
        default=DEFAULT_STAGE_A_MESH_KM,
        help="Geographic screening mesh step in km (default: 20)",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=DEFAULT_STAGE_A_TOP_N,
        help="Number of top representative sites to export (default: 10)",
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
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=_default_output_dir(),
        help="Folder where output CSV/JSON/PNG artifacts are written",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    cfg = SiteScreeningStageAConfig(
        start_year=int(args.start_year),
        end_year=int(args.end_year),
        mesh_km=float(args.mesh_km),
        top_n=int(args.top_n),
        park_mw=float(args.park_mw),
        price_per_mw=float(args.price_per_mw),
        min_samples=int(args.min_samples),
        economic_scenario=str(args.economic_scenario),
        project_life_years=args.project_life_years,
        bbox_nwse=DEFAULT_STAGE_A_BBOX_NWSE,
        output_dir=Path(args.output_dir),
    )

    result = run_site_screening_stage_a(config=cfg)
    outputs = export_site_screening_stage_a_outputs(result=result, output_dir=cfg.output_dir)

    summary = result["summary"]
    best = summary.get("best_site")

    print("----- Wind Site Screening Stage A (Weibull) -----")
    print(
        f"Years: {cfg.start_year}-{cfg.end_year} | mesh_km={cfg.mesh_km:.1f} | top_n={cfg.top_n} | "
        f"bbox_nwse={cfg.bbox_nwse}"
    )
    print(
        f"Mesh points: {summary['mesh_point_count']} | ERA5 unique cells: {summary['era5_unique_cell_count']} | "
        f"Ranked representatives: {summary['ranked_site_count']}"
    )
    if isinstance(best, dict):
        print(
            "Best site: "
            f"rank={best.get('top_rank')} "
            f"lat={float(best.get('latitude')):.5f} "
            f"lon={float(best.get('longitude')):.5f} "
            f"energy={float(best.get('annual_energy_park_mwh')):.2f} MWh "
            f"model={best.get('best_model_by_energy')}"
        )
    print(f"mesh_points_20km.csv: {outputs['mesh_points_20km']}")
    print(f"era5_cell_screening.csv: {outputs['era5_cell_screening']}")
    print(f"top10_sites_stage_a.csv: {outputs['top10_sites_stage_a']}")
    print(f"site_screening_stage_a_summary.json: {outputs['site_screening_stage_a_summary']}")
    print(f"top10_sites_stage_a.png: {outputs['top10_sites_stage_a_png']}")


if __name__ == "__main__":
    main()
