from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


REQUIRED_COLUMNS = {
    "model_name",
    "annual_energy_park_mwh",
    "total_annual_cost_per_mwh_cad",
    "rank_energy",
    "rank_total_cost",
}


def _parse_ranking(ranking_df: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS.difference(ranking_df.columns)
    if missing:
        raise ValueError(f"Missing required columns in ranking CSV: {sorted(missing)}")

    out = ranking_df.copy()
    numeric_cols = [
        "annual_energy_park_mwh",
        "total_annual_cost_per_mwh_cad",
        "rank_energy",
        "rank_total_cost",
    ]
    for col in numeric_cols:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    out = out.dropna(subset=["model_name", *numeric_cols]).copy()
    if out.empty:
        raise ValueError("Ranking CSV has no valid rows after parsing")
    out["rank_energy"] = out["rank_energy"].astype(int)
    out["rank_total_cost"] = out["rank_total_cost"].astype(int)
    out["rank_delta_total_vs_energy"] = out["rank_total_cost"] - out["rank_energy"]
    return out


def plot_multi_criteria_ranking(
    ranking_df: pd.DataFrame,
    output_png: Path,
    title: str = "Turbine Ranking — Energy vs Economic Criteria",
) -> None:
    output_png.parent.mkdir(parents=True, exist_ok=True)

    df = _parse_ranking(ranking_df)

    energy_df = df.sort_values("rank_energy", ascending=True, kind="mergesort").copy()
    cost_df = df.sort_values("rank_total_cost", ascending=True, kind="mergesort").copy()

    fig = plt.figure(figsize=(16, 12), constrained_layout=True)
    grid = fig.add_gridspec(3, 1, height_ratios=[3, 3, 3], hspace=0.18)

    # Panel A: energy ranking.
    ax1 = fig.add_subplot(grid[0, 0])
    energy_plot_df = energy_df.iloc[::-1]
    ax1.barh(energy_plot_df["model_name"], energy_plot_df["annual_energy_park_mwh"], color="#4e79a7")
    ax1.set_title(f"{title} — Panel A: Energy ranking", fontsize=13)
    ax1.set_xlabel("Annual energy (MWh)")
    ax1.set_ylabel("Turbine model")
    ax1.grid(axis="x", linestyle="--", alpha=0.35)
    for _, row in energy_df.head(3).iterrows():
        ax1.text(
            float(row["annual_energy_park_mwh"]) * 1.005,
            row["model_name"],
            f"R{int(row['rank_energy'])} | {float(row['annual_energy_park_mwh']):,.0f} MWh",
            va="center",
            fontsize=8,
        )

    # Panel B: total annualized cost ranking.
    ax2 = fig.add_subplot(grid[1, 0])
    cost_plot_df = cost_df.iloc[::-1]
    ax2.barh(
        cost_plot_df["model_name"],
        cost_plot_df["total_annual_cost_per_mwh_cad"],
        color="#e15759",
    )
    ax2.set_title("Panel B: Total annualized cost ranking", fontsize=13)
    ax2.set_xlabel("Total annualized cost (C$/MWh)")
    ax2.set_ylabel("Turbine model")
    ax2.grid(axis="x", linestyle="--", alpha=0.35)
    for _, row in cost_df.head(3).iterrows():
        ax2.text(
            float(row["total_annual_cost_per_mwh_cad"]) * 1.005,
            row["model_name"],
            f"R{int(row['rank_total_cost'])} | {float(row['total_annual_cost_per_mwh_cad']):.1f} C$/MWh",
            va="center",
            fontsize=8,
        )

    # Panel C: slope chart for rank permutation (energy -> total cost).
    ax3 = fig.add_subplot(grid[2, 0])
    x_left, x_right = 0.0, 1.0
    for _, row in df.iterrows():
        y1 = int(row["rank_energy"])
        y2 = int(row["rank_total_cost"])
        delta = int(row["rank_delta_total_vs_energy"])
        if delta < 0:
            color = "#59a14f"  # improves on cost ranking
        elif delta > 0:
            color = "#e15759"  # worsens on cost ranking
        else:
            color = "#9c9c9c"
        ax3.plot([x_left, x_right], [y1, y2], color=color, linewidth=1.8, alpha=0.85)

    ax3.set_xlim(-0.1, 1.1)
    ax3.set_ylim(len(df) + 0.5, 0.5)
    ax3.set_xticks([x_left, x_right])
    ax3.set_xticklabels(["rank_energy", "rank_total_cost"])
    ax3.set_ylabel("Rank (1 = best)")
    ax3.set_title("Panel C: Rank permutation (Energy -> Total Cost)", fontsize=13)
    ax3.grid(axis="y", linestyle="--", alpha=0.25)

    # annotate top movers by absolute rank delta
    movers = df.assign(abs_delta=df["rank_delta_total_vs_energy"].abs()).sort_values(
        ["abs_delta", "model_name"],
        ascending=[False, True],
        kind="mergesort",
    ).head(3)
    for _, row in movers.iterrows():
        label = (
            f"{row['model_name']} "
            f"(E:{int(row['rank_energy'])} -> C:{int(row['rank_total_cost'])}, "
            f"delta={int(row['rank_delta_total_vs_energy'])})"
        )
        ax3.text(1.03, float(row["rank_total_cost"]), label, va="center", fontsize=8)

    plt.savefig(output_png, dpi=220)
    plt.close(fig)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Visualize multi-criteria turbine ranking (energy and economic criteria)."
    )
    parser.add_argument(
        "--ranking-csv",
        type=Path,
        required=True,
        help="Path to turbine_ranking_multi_criteria.csv",
    )
    parser.add_argument(
        "--output-png",
        type=Path,
        default=None,
        help="Output PNG path (default: <ranking-dir>/turbine_ranking_multi_criteria.png)",
    )
    parser.add_argument(
        "--title",
        type=str,
        default="Turbine Ranking — Energy vs Economic Criteria",
        help="Figure title",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    ranking_csv = Path(args.ranking_csv)
    if not ranking_csv.exists():
        raise FileNotFoundError(f"Ranking CSV not found: {ranking_csv}")

    output_png = (
        Path(args.output_png)
        if args.output_png is not None
        else ranking_csv.parent / "turbine_ranking_multi_criteria.png"
    )

    ranking_df = pd.read_csv(ranking_csv)
    plot_multi_criteria_ranking(ranking_df=ranking_df, output_png=output_png, title=str(args.title))

    print("----- Turbine Ranking Multi-Criteria Visualization -----")
    print(f"Input ranking CSV: {ranking_csv}")
    print(f"Output PNG: {output_png}")


if __name__ == "__main__":
    main()
