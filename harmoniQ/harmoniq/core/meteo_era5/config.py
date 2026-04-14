from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from harmoniq import ERA5_NORMALIZED_PATH, ERA5_RAW_PATH


@dataclass(frozen=True)
class Era5Config:
    dataset: str = "reanalysis-era5-single-levels"
    year: int = 2024
    area_nwse: tuple[float, float, float, float] = (62.0, -79.8, 44.5, -57.0)
    grid_deg: tuple[float, float] = (1.5, 1.5)
    raw_dir: Path = ERA5_RAW_PATH
    normalized_dir: Path = ERA5_NORMALIZED_PATH
    timezone_default: str = "UTC"
    max_retries: int = 5
    retry_backoff_s: float = 2.0

    def raw_month_dir(self, year: int, month: int) -> Path:
        return self.raw_dir / f"year={year}" / f"month={month:02d}"

    def raw_month_file(self, year: int, month: int) -> Path:
        return self.raw_month_dir(year, month) / f"era5_qc_{year}_{month:02d}.nc"

    def normalized_month_dir(self, year: int, month: int) -> Path:
        return self.normalized_dir / f"year={year}" / f"month={month:02d}"

    def normalized_month_file(self, year: int, month: int) -> Path:
        return self.normalized_month_dir(year, month) / f"era5_normalized_{year}_{month:02d}.parquet"
