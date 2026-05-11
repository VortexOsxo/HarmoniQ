from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from harmoniq.core.meteo_era5 import Era5WeatherProvider
from harmoniq.modules.eolienne.weibull.Weibull_calcule import drop_feb29_from_index


def _default_run_dir() -> Path:
    return (
        Path("harmoniq")
        / "modules"
        / "eolienne"
        / "plot"
        / "run_test_001"
    )


def _real_2024_bin_probabilities(
    latitude: float,
    longitude: float,
    provider: Era5WeatherProvider | None = None,
) -> pd.DataFrame:
    service = provider or Era5WeatherProvider()
    meteo = service.get_weather_point(
        latitude=float(latitude),
        longitude=float(longitude),
        start=datetime(2024, 1, 1, 0, 0, 0),
        end=datetime(2024, 12, 31, 23, 0, 0),
        tz_out="UTC",
    ).copy()
    if meteo.empty:
        raise ValueError("No ERA5 samples returned for 2024")

    meteo.index = pd.to_datetime(meteo.index, utc=True).tz_localize(None)
    meteo = drop_feb29_from_index(meteo)

    wind_ms = pd.to_numeric(meteo["vitesse_vent_kmh"], errors="coerce").to_numpy(dtype=float) / 3.6
    wind_ms = wind_ms[np.isfinite(wind_ms)]
    wind_ms = wind_ms[wind_ms >= 0.0]
    if wind_ms.size == 0:
        raise ValueError("No valid non-negative 2024 wind samples")

    speeds = np.arange(0, 26, dtype=int)
    counts = np.zeros(26, dtype=float)
    for idx, v in enumerate(speeds):
        if v < 25:
            counts[idx] = float(np.sum((wind_ms >= v) & (wind_ms < (v + 1))))
        else:
            counts[idx] = float(np.sum(wind_ms >= 25.0))

    probs = counts / float(wind_ms.size)
    labels = [f"[{v},{v + 1})" for v in range(25)] + ["[25,+inf)"]
    return pd.DataFrame(
        {
            "speed_m_s": speeds,
            "speed_bin": labels,
            "probability_real_2024": probs,
            "probability_pct_real_2024": probs * 100.0,
            "count_real_2024": counts.astype(int),
            "sample_count_real_2024": int(wind_ms.size),
        }
    )


def _load_weibull_bins(wind_bins_csv: Path) -> pd.DataFrame:
    if not wind_bins_csv.exists():
        raise FileNotFoundError(f"wind_probability_bins.csv not found: {wind_bins_csv}")
    df = pd.read_csv(wind_bins_csv)
    required = {"speed_m_s", "probability_pct"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Missing columns in {wind_bins_csv}: {sorted(missing)}")
    out = df.copy()
    out["speed_m_s"] = pd.to_numeric(out["speed_m_s"], errors="coerce").astype("Int64")
    out["probability_pct"] = pd.to_numeric(out["probability_pct"], errors="coerce")
    out = out.dropna(subset=["speed_m_s", "probability_pct"]).copy()
    out["speed_m_s"] = out["speed_m_s"].astype(int)
    out = out.sort_values("speed_m_s", kind="mergesort").reset_index(drop=True)
    if not np.array_equal(out["speed_m_s"].to_numpy(dtype=int), np.arange(26, dtype=int)):
        raise ValueError("Weibull bins must contain speed_m_s from 0 to 25")
    return out


def _read_point_from_summary(summary_json: Path) -> tuple[float, float]:
    if not summary_json.exists():
        raise FileNotFoundError(f"best_turbine_summary.json not found: {summary_json}")
    payload = json.loads(summary_json.read_text(encoding="utf-8"))
    input_data = payload.get("input", {})
    if not isinstance(input_data, dict):
        raise ValueError(f"Invalid input block in {summary_json}")
    lat = input_data.get("latitude")
    lon = input_data.get("longitude")
    if lat is None or lon is None:
        raise ValueError(f"Latitude/longitude not found in {summary_json}")
    return float(lat), float(lon)


def plot_weibull_vs_real_2024(
    weibull_bins: pd.DataFrame,
    real_bins: pd.DataFrame,
    output_png: Path,
    title: str,
) -> None:
    output_png.parent.mkdir(parents=True, exist_ok=True)
    merged = weibull_bins.merge(real_bins, on="speed_m_s", how="inner")
    if merged.empty:
        raise ValueError("No common speed bins between Weibull and real distributions")

    x = merged["speed_m_s"].to_numpy(dtype=int)
    y_weibull = merged["probability_pct"].to_numpy(dtype=float)
    y_real = merged["probability_pct_real_2024"].to_numpy(dtype=float)

    fig, ax = plt.subplots(figsize=(14, 7))
    ax.bar(
        x,
        y_weibull,
        width=0.85,
        color="#4e79a7",
        alpha=0.70,
        label="Weibull (fit 2015-2024)",
    )
    ax.plot(
        x,
        y_real,
        color="#e15759",
        marker="o",
        linewidth=2.0,
        markersize=5,
        label="Reel 2024 (empirique)",
    )

    ax.set_title(title, fontsize=16)
    ax.set_xlabel("Vitesse du vent (m/s)")
    ax.set_ylabel("Probabilite (%)")
    ax.set_xticks(np.arange(0, 26, 1))
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.legend(loc="upper right")

    rmse = float(np.sqrt(np.mean((y_real - y_weibull) ** 2)))
    mae = float(np.mean(np.abs(y_real - y_weibull)))
    ax.text(
        0.01,
        0.98,
        f"MAE={mae:.2f} pts | RMSE={rmse:.2f} pts",
        transform=ax.transAxes,
        va="top",
        ha="left",
        fontsize=10,
        bbox={"facecolor": "white", "edgecolor": "#bbbbbb", "alpha": 0.85},
    )

    plt.tight_layout()
    plt.savefig(output_png, dpi=220)
    plt.close(fig)


def build_parser() -> argparse.ArgumentParser:
    default_dir = _default_run_dir()
    parser = argparse.ArgumentParser(
        description=(
            "Overlay Weibull wind-speed distribution with empirical real 2024 distribution "
            "for the same lat/lon point."
        )
    )
    parser.add_argument(
        "--summary-json",
        type=Path,
        default=default_dir / "best_turbine_summary.json",
        help="Path to best_turbine_summary.json (for latitude/longitude)",
    )
    parser.add_argument(
        "--wind-bins-csv",
        type=Path,
        default=default_dir / "wind_probability_bins.csv",
        help="Path to Weibull bins CSV",
    )
    parser.add_argument(
        "--output-png",
        type=Path,
        default=default_dir / "wind_speed_distribution_weibull_vs_real_2024.png",
        help="Output PNG path",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=default_dir / "wind_speed_distribution_weibull_vs_real_2024.csv",
        help="Output merged CSV path",
    )
    parser.add_argument(
        "--title",
        type=str,
        default="Comparaison distribution vitesses du vent: Weibull vs reel 2024",
        help="Plot title",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)

    latitude, longitude = _read_point_from_summary(Path(args.summary_json))
    weibull_bins = _load_weibull_bins(Path(args.wind_bins_csv))
    real_bins = _real_2024_bin_probabilities(latitude=latitude, longitude=longitude)

    merged = weibull_bins.merge(real_bins, on="speed_m_s", how="inner")
    merged["delta_pct_points_real_minus_weibull"] = (
        merged["probability_pct_real_2024"] - merged["probability_pct"]
    )
    output_csv = Path(args.output_csv)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(output_csv, index=False, encoding="utf-8")

    output_png = Path(args.output_png)
    plot_weibull_vs_real_2024(
        weibull_bins=weibull_bins,
        real_bins=real_bins,
        output_png=output_png,
        title=str(args.title),
    )

    print("----- Wind Distribution Comparison -----")
    print(f"Point: lat={latitude:.5f}, lon={longitude:.5f}")
    print(f"Weibull bins CSV: {Path(args.wind_bins_csv)}")
    print(f"Output PNG: {output_png}")
    print(f"Output CSV: {output_csv}")


if __name__ == "__main__":
    main()

