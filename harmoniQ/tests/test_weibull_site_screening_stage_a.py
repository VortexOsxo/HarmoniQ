from __future__ import annotations

from dataclasses import replace
from datetime import datetime
import json

import numpy as np
import pandas as pd

from harmoniq.modules.eolienne.weibull import site_screening_stage_a
from harmoniq.modules.eolienne.weibull.site_screening_stage_a import (
    SiteScreeningStageAConfig,
    generate_metric_mesh_points,
    map_points_to_era5_floor_cells,
    run_site_screening_stage_a,
    select_representative_points_per_cell,
)
from harmoniq.scripts import select_wind_sites_weibull_stage_a


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
        phase = np.linspace(0.0, 2.0 * np.pi, n, endpoint=False)
        # deterministic site-dependent profile in km/h
        base = 30.0 + (float(latitude) - 44.5) * 2.0 + (float(longitude) + 79.8) * 0.9
        wind_kmh = base + 8.0 * np.sin(phase) + 2.5 * np.cos(2.0 * phase)
        wind_kmh = np.maximum(wind_kmh, 2.0)
        data = pd.DataFrame(
            {
                "latitude": np.full(n, float(latitude)),
                "longitude": np.full(n, float(longitude)),
                "temperature_C": np.full(n, 4.0),
                "vitesse_vent_kmh": wind_kmh,
                "direction_vent": np.full(n, 180.0),
            },
            index=index,
        )
        return data


def _fake_era5_cells() -> pd.DataFrame:
    rows = []
    for lat in (44.5, 46.0):
        for lon in (-79.8, -78.3):
            rows.append(
                {
                    "era5_latitude": float(lat),
                    "era5_longitude": float(lon),
                    "era5_longitude_norm": float(lon),
                }
            )
    return pd.DataFrame(rows)


def test_generate_metric_mesh_spacing_and_bbox_coverage():
    bbox = (46.2, -79.8, 44.5, -78.2)
    mesh = generate_metric_mesh_points(mesh_km=20.0, bbox_nwse=bbox, projected_crs="EPSG:32198")
    assert not mesh.empty

    north, west, south, east = bbox
    assert float(mesh["latitude"].min()) >= south - 1e-9
    assert float(mesh["latitude"].max()) <= north + 1e-9
    assert float(mesh["longitude"].min()) >= west - 1e-9
    assert float(mesh["longitude"].max()) <= east + 1e-9

    x_unique = np.sort(mesh["x_m"].unique())
    y_unique = np.sort(mesh["y_m"].unique())
    x_diffs = np.diff(x_unique) if x_unique.size > 1 else np.array([], dtype=float)
    y_diffs = np.diff(y_unique) if y_unique.size > 1 else np.array([], dtype=float)
    diffs = np.concatenate([x_diffs, y_diffs]) if (x_diffs.size + y_diffs.size) > 0 else np.array([])
    assert diffs.size > 0
    assert np.isclose(float(np.median(diffs)), 20000.0, atol=1e-6)


def test_map_points_to_era5_floor_cells_expected_mapping():
    mesh = pd.DataFrame(
        {
            "mesh_point_id": [1, 2],
            "mesh_ix": [0, 1],
            "mesh_iy": [0, 0],
            "x_m": [0.0, 1.0],
            "y_m": [0.0, 1.0],
            "latitude": [45.2, 46.1],
            "longitude": [-79.0, -78.1],
        }
    )
    era5_cells = _fake_era5_cells()
    mapped = map_points_to_era5_floor_cells(mesh_points=mesh, era5_cells=era5_cells)

    first = mapped.loc[mapped["mesh_point_id"] == 1].iloc[0]
    second = mapped.loc[mapped["mesh_point_id"] == 2].iloc[0]
    assert np.isclose(float(first["era5_latitude"]), 44.5)
    assert np.isclose(float(first["era5_longitude"]), -79.8)
    assert np.isclose(float(second["era5_latitude"]), 46.0)
    assert np.isclose(float(second["era5_longitude"]), -78.3)


def test_select_representative_points_per_cell_keeps_nearest():
    mapped = pd.DataFrame(
        {
            "mesh_point_id": [1, 2, 3],
            "era5_cell_id": ["A", "A", "B"],
            "distance_to_cell_center_km": [4.0, 1.5, 2.0],
        }
    )
    reps = select_representative_points_per_cell(mapped)
    assert len(reps) == 2
    a = reps.loc[reps["era5_cell_id"] == "A"].iloc[0]
    assert int(a["mesh_point_id"]) == 2


def test_run_stage_a_top_n_sorted_and_unique_cells(monkeypatch):
    monkeypatch.setattr(site_screening_stage_a, "load_era5_available_cells", lambda start_year, end_year: _fake_era5_cells())

    cfg = SiteScreeningStageAConfig(
        start_year=2024,
        end_year=2024,
        mesh_km=20.0,
        top_n=3,
        park_mw=200.0,
        min_samples=100,
        enforce_quebec_boundary=False,
        bbox_nwse=(46.2, -79.8, 44.5, -78.2),
    )
    result = run_site_screening_stage_a(config=cfg, provider=FakeEra5Provider())
    top = pd.DataFrame(result["top_sites"])
    assert not top.empty
    assert len(top) <= 3
    assert top["era5_cell_id"].is_unique
    assert top["annual_energy_park_mwh"].is_monotonic_decreasing


def test_run_stage_a_representative_is_nearest_cell_point(monkeypatch):
    monkeypatch.setattr(site_screening_stage_a, "load_era5_available_cells", lambda start_year, end_year: _fake_era5_cells())

    cfg = SiteScreeningStageAConfig(
        start_year=2024,
        end_year=2024,
        mesh_km=20.0,
        top_n=4,
        park_mw=200.0,
        min_samples=100,
        enforce_quebec_boundary=False,
        bbox_nwse=(46.2, -79.8, 44.5, -78.2),
    )
    result = run_site_screening_stage_a(config=cfg, provider=FakeEra5Provider())
    mesh = pd.DataFrame(result["mesh_points"])
    top = pd.DataFrame(result["top_sites"])

    for row in top.itertuples(index=False):
        cell_points = mesh.loc[mesh["era5_cell_id"] == row.era5_cell_id]
        expected_min = float(cell_points["distance_to_cell_center_km"].min())
        assert np.isclose(float(row.distance_to_cell_center_km), expected_min, atol=1e-9)


def test_cli_stage_a_generates_expected_artifacts(monkeypatch, tmp_path):
    monkeypatch.setattr(site_screening_stage_a, "load_era5_available_cells", lambda start_year, end_year: _fake_era5_cells())

    original_run = site_screening_stage_a.run_site_screening_stage_a

    def _run_with_fake_provider(config):
        return original_run(config=replace(config, enforce_quebec_boundary=False), provider=FakeEra5Provider())

    monkeypatch.setattr(select_wind_sites_weibull_stage_a, "run_site_screening_stage_a", _run_with_fake_provider)

    select_wind_sites_weibull_stage_a.main(
        [
            "--start-year",
            "2024",
            "--end-year",
            "2024",
            "--mesh-km",
            "20",
            "--top-n",
            "3",
            "--min-samples",
            "100",
            "--output-dir",
            str(tmp_path),
        ]
    )

    mesh_path = tmp_path / "mesh_points_20km.csv"
    cell_path = tmp_path / "era5_cell_screening.csv"
    top_path = tmp_path / "top10_sites_stage_a.csv"
    summary_path = tmp_path / "site_screening_stage_a_summary.json"
    plot_path = tmp_path / "top10_sites_stage_a.png"
    assert mesh_path.exists()
    assert cell_path.exists()
    assert top_path.exists()
    assert summary_path.exists()
    assert plot_path.exists()

    top_df = pd.read_csv(top_path)
    with summary_path.open("r", encoding="utf-8") as fp:
        summary = json.load(fp)
    best = summary["summary"]["best_site"]
    first = top_df.iloc[0]
    assert int(best["top_rank"]) == 1
    assert np.isclose(float(best["annual_energy_park_mwh"]), float(first["annual_energy_park_mwh"]))
