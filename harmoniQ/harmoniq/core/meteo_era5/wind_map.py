from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import pandas as pd

from harmoniq.core.meteo_era5.cache import Era5Cache
from harmoniq.core.meteo_era5.config import Era5Config


@dataclass(frozen=True)
class WindGridMeta:
    lat_step_deg: float
    lon_step_deg: float
    lat_half_step_deg: float
    lon_half_step_deg: float


class Era5WindMapService:
    def __init__(self, config: Era5Config | None = None, cache: Era5Cache | None = None):
        self.config = config or Era5Config()
        self.cache = cache or Era5Cache(config=self.config)
        self._annual_cache: dict[int, dict] = {}
        self._lock = threading.Lock()

    def _normalized_root(self) -> Path:
        return self.config.cache_dir / "normalized"

    def _parse_year_dir(self, path: Path) -> int | None:
        token = path.name
        if not token.startswith("year="):
            return None
        try:
            return int(token.split("=", 1)[1])
        except (TypeError, ValueError):
            return None

    def _has_full_year_cache(self, year: int) -> bool:
        return all(self.config.normalized_month_file(year, month).exists() for month in range(1, 13))

    def get_available_years(self) -> list[int]:
        root = self._normalized_root()
        if not root.exists():
            return []

        years: list[int] = []
        for year_dir in root.glob("year=*"):
            year = self._parse_year_dir(year_dir)
            if year is None:
                continue
            if self._has_full_year_cache(year):
                years.append(year)
        return sorted(set(years))

    def get_default_year(self, years: list[int] | None = None) -> int:
        available = years if years is not None else self.get_available_years()
        if not available:
            raise FileNotFoundError("No ERA5 yearly cache available for wind-map endpoints.")
        if 2024 in available:
            return 2024
        return max(available)

    def _grid_meta(self) -> WindGridMeta:
        lat_step, lon_step = self.config.grid_deg
        return WindGridMeta(
            lat_step_deg=float(lat_step),
            lon_step_deg=float(lon_step),
            lat_half_step_deg=float(lat_step) / 2.0,
            lon_half_step_deg=float(lon_step) / 2.0,
        )

    def _build_annual_payload(self, year: int) -> dict:
        if year not in self.get_available_years():
            raise FileNotFoundError(
                f"ERA5 wind-map cache unavailable for year={year}. "
                "Expected full monthly parquet coverage."
            )

        start = datetime(year, 1, 1, 0, 0, 0)
        end = datetime(year, 12, 31, 23, 0, 0)
        df = self.cache.read_range(start_utc=start, end_utc=end)

        if "vitesse_vent_kmh" not in df.columns:
            raise ValueError("Missing required ERA5 column: vitesse_vent_kmh")

        grouped = (
            df.groupby(["latitude", "longitude"], as_index=False)["vitesse_vent_kmh"]
            .mean()
            .rename(columns={"vitesse_vent_kmh": "mean_wind_kmh"})
            .sort_values(["latitude", "longitude"], ascending=[True, True], kind="mergesort")
        )

        cells = [
            {
                "latitude": float(row.latitude),
                "longitude": float(row.longitude),
                "mean_wind_kmh": float(row.mean_wind_kmh),
            }
            for row in grouped.itertuples(index=False)
        ]

        value_series = grouped["mean_wind_kmh"]
        min_value = float(value_series.min()) if not value_series.empty else 0.0
        max_value = float(value_series.max()) if not value_series.empty else 0.0
        grid = self._grid_meta()
        return {
            "year": int(year),
            "metric": "vitesse_vent_kmh_mean",
            "cells": cells,
            "grid": {
                "lat_step_deg": grid.lat_step_deg,
                "lon_step_deg": grid.lon_step_deg,
                "lat_half_step_deg": grid.lat_half_step_deg,
                "lon_half_step_deg": grid.lon_half_step_deg,
            },
            "value_range": {"min": min_value, "max": max_value},
        }

    def get_annual_wind_map(self, year: int) -> dict:
        if year in self._annual_cache:
            return self._annual_cache[year]

        with self._lock:
            if year in self._annual_cache:
                return self._annual_cache[year]
            payload = self._build_annual_payload(year=year)
            self._annual_cache[year] = payload
            return payload
