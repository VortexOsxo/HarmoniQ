from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd


HQ_DATASET_ID = "historique-production-electricite-quebec"


def _download_hq_wind_2024(year: int) -> pd.Series:
    start = f"{year}-01-01T00:00:00"
    end = f"{year + 1}-01-01T00:00:00"
    url = (
        "https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/"
        f"{HQ_DATASET_ID}/exports/csv"
        f"?select=date,eolien"
        f"&where=date%20%3E%3D%20date'{start}'%20and%20date%20%3C%20date'{end}'"
        "&timezone=UTC"
    )
    hq = pd.read_csv(url, sep=";")
    hq["date"] = pd.to_datetime(hq["date"], utc=True)
    hq = hq.sort_values("date")
    series = (
        hq.set_index("date")["eolien"]
        .astype(float)
        .groupby(level=0)
        .mean()
        .rename("production_hq_eolien_mw")
    )
    return series


def _load_simulation(csv_path: Path) -> pd.Series:
    sim = pd.read_csv(csv_path)
    if "timestamp" not in sim.columns or "production_agregee_mw" not in sim.columns:
        raise ValueError(
            "Simulation CSV must contain 'timestamp' and 'production_agregee_mw' columns."
        )
    sim["timestamp"] = pd.to_datetime(sim["timestamp"], utc=True)
    sim = sim.sort_values("timestamp")
    series = sim.set_index("timestamp")["production_agregee_mw"].astype(float).rename("production_simulee_mw")
    return series


def _build_comparison(sim: pd.Series, hq: pd.Series) -> pd.DataFrame:
    common_index = sim.index.intersection(hq.index)
    if len(common_index) == 0:
        raise ValueError("No common timestamps found between simulation and Hydro-Québec data.")

    out = pd.DataFrame(
        {
            "production_simulee_mw": sim.reindex(common_index),
            "production_hq_eolien_mw": hq.reindex(common_index),
        },
        index=common_index,
    )
    out["ecart_mw"] = out["production_simulee_mw"] - out["production_hq_eolien_mw"]
    return out


def _plot_comparison(df: pd.DataFrame, output_png: Path, year: int) -> None:
    fig, ax = plt.subplots(figsize=(15, 5))
    ax.plot(df.index, df["production_simulee_mw"], linewidth=0.9, alpha=0.8, label="Simulation agrégée 43 parcs")
    ax.plot(df.index, df["production_hq_eolien_mw"], linewidth=0.9, alpha=0.8, label="Hydro-Québec (eolien)")
    ax.set_title(f"Comparaison production eolienne 2024 - simulation vs Hydro-Quebec ({year})")
    ax.set_xlabel("Temps (UTC)")
    ax.set_ylabel("Puissance (MW)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.tight_layout()
    fig.savefig(output_png, dpi=160)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare local aggregated wind curve (43 parks) against Hydro-Québec historical wind production."
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2024,
        help="Year to compare (default: 2024)",
    )
    parser.add_argument(
        "--simulation-csv",
        type=Path,
        default=Path("harmoniq/modules/eolienne/plot/aggregated_43_parks/production_agregee_43_parcs_2024.csv"),
        help="Path to local aggregated simulation CSV",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("harmoniq/modules/eolienne/plot/aggregated_43_parks"),
        help="Output directory for comparison artifacts",
    )
    args = parser.parse_args()

    sim_series = _load_simulation(args.simulation_csv)
    hq_series = _download_hq_wind_2024(year=args.year)
    comparison = _build_comparison(sim=sim_series, hq=hq_series)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    csv_out = args.output_dir / f"comparaison_simule_vs_hq_eolien_{args.year}.csv"
    png_out = args.output_dir / f"comparaison_simule_vs_hq_eolien_{args.year}.png"

    comparison.reset_index(names="timestamp").to_csv(csv_out, index=False, encoding="utf-8")
    _plot_comparison(comparison, output_png=png_out, year=args.year)

    mae = float(comparison["ecart_mw"].abs().mean())
    rmse = float((comparison["ecart_mw"] ** 2).mean() ** 0.5)
    energy_sim_mwh = float(comparison["production_simulee_mw"].sum())
    energy_hq_mwh = float(comparison["production_hq_eolien_mw"].sum())

    print("----- Comparaison Simulation vs Hydro-Quebec -----")
    print(f"Points compares: {len(comparison)}")
    print(f"Energie simulee (MWh): {energy_sim_mwh:.2f}")
    print(f"Energie HQ (MWh): {energy_hq_mwh:.2f}")
    print(f"MAE (MW): {mae:.2f}")
    print(f"RMSE (MW): {rmse:.2f}")
    print(f"CSV: {csv_out}")
    print(f"PNG: {png_out}")


if __name__ == "__main__":
    main()
