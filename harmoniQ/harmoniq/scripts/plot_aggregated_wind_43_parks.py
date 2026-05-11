from __future__ import annotations

import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from harmoniq.db import CRUD
from harmoniq.db.engine import get_db
from harmoniq.db.schemas import ScenarioBase
from harmoniq.modules.eolienne import InfraParcEolienne


logger = logging.getLogger("harmoniq.eolienne.aggregate_plot")


def _build_scenario(year: int) -> ScenarioBase:
    start = datetime(year, 1, 1, 0, 0, 0)
    end = datetime(year, 12, 31, 0, 0, 0)
    return ScenarioBase(
        nom=f"eolien_aggregate_{year}",
        description=f"Aggregate wind production for all existing parks ({year})",
        date_de_debut=start,
        date_de_fin=end,
        pas_de_temps=timedelta(hours=1),
    )


def _compute_aggregate_series(year: int) -> tuple[pd.Series, int]:
    db = next(get_db())
    parks = CRUD.read_all_eolienne_parc(db)
    if not parks:
        raise ValueError("No wind parks found in database.")

    scenario = _build_scenario(year=year)
    aggregate_mw: pd.Series | None = None

    for idx, park in enumerate(parks, start=1):
        logger.info("Processing park %s/%s: %s", idx, len(parks), park.nom)
        infra = InfraParcEolienne(park)
        infra.charger_scenario(scenario)
        production = infra.calculer_production()
        series_mw = (
            production.assign(tempsdate=pd.to_datetime(production["tempsdate"]))
            .set_index("tempsdate")["puissance"]
            .astype(float)
            .fillna(0.0)
            / 1000.0
        )
        if aggregate_mw is None:
            aggregate_mw = series_mw
        else:
            aggregate_mw = aggregate_mw.add(series_mw, fill_value=0.0)

    if aggregate_mw is None or aggregate_mw.empty:
        raise ValueError("No production series computed.")

    aggregate_mw = aggregate_mw.sort_index()
    return aggregate_mw, len(parks)


def _export_outputs(series_mw: pd.Series, park_count: int, year: int, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    csv_path = output_dir / f"production_agregee_{park_count}_parcs_{year}.csv"
    png_path = output_dir / f"production_agregee_{park_count}_parcs_{year}.png"

    out_df = pd.DataFrame(
        {
            "timestamp": series_mw.index,
            "production_agregee_mw": series_mw.values,
        }
    )
    out_df.to_csv(csv_path, index=False, encoding="utf-8")

    fig, ax = plt.subplots(figsize=(15, 5))
    ax.plot(series_mw.index, series_mw.values, color="#1f77b4", linewidth=0.9)
    ax.set_title(f"Production eolienne agregee - {park_count} parcs ({year})")
    ax.set_xlabel("Temps")
    ax.set_ylabel("Puissance agregee (MW)")
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(png_path, dpi=160)
    plt.close(fig)

    return csv_path, png_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate an aggregated wind-production curve for all existing wind parks."
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2024,
        help="Year to simulate (default: 2024)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("harmoniq/modules/eolienne/plot/aggregated_43_parks"),
        help="Output folder for CSV and PNG",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    series_mw, park_count = _compute_aggregate_series(year=args.year)
    csv_path, png_path = _export_outputs(
        series_mw=series_mw,
        park_count=park_count,
        year=args.year,
        output_dir=args.output_dir,
    )

    total_mwh = float(series_mw.sum())
    print("----- Aggregated Wind Curve -----")
    print(f"Parks aggregated: {park_count}")
    print(f"Samples: {len(series_mw)}")
    print(f"Approx total energy over period: {total_mwh:.2f} MWh")
    print(f"CSV: {csv_path}")
    print(f"PNG: {png_path}")


if __name__ == "__main__":
    main()
