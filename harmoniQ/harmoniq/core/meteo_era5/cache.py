from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from harmoniq.core.meteo_era5.config import Era5Config
from harmoniq.core.meteo_era5.transform import convert_timezone, normalize_longitude

logger = logging.getLogger("harmoniq.meteo.era5.cache")


class Era5Cache:
    def __init__(self, config: Era5Config | None = None):
        self.config = config or Era5Config()

    @staticmethod
    def _to_utc_timestamp(value: datetime) -> pd.Timestamp:
        ts = pd.Timestamp(value)
        if ts.tzinfo is None:
            ts = ts.tz_localize("UTC")
        else:
            ts = ts.tz_convert("UTC")
        return ts

    def has_year(self, year: int) -> bool:
        year_dir = self.config.normalized_dir / f"year={year}"
        return year_dir.exists() and any(year_dir.rglob("*.parquet"))

    def write_monthly_parquet(self, df: pd.DataFrame, year: int) -> list[Path]:
        if not isinstance(df.index, pd.DatetimeIndex):
            raise TypeError("Expected DatetimeIndex for ERA5 normalized dataframe")

        work = df.copy()
        work.index = pd.to_datetime(work.index, utc=True)
        work["date"] = work.index
        work["year"] = work["date"].dt.year
        work["month"] = work["date"].dt.month

        written_paths: list[Path] = []
        month_groups = work[work["year"] == year].groupby(["year", "month"], sort=True)
        for (year_value, month_value), month_df in month_groups:
            out_file = self.config.normalized_month_file(int(year_value), int(month_value))
            out_file.parent.mkdir(parents=True, exist_ok=True)
            payload = month_df.drop(columns=["year", "month"]).reset_index(drop=True)
            payload.to_parquet(out_file, index=False)
            logger.info(
                "Wrote ERA5 normalized parquet: year=%s month=%02d rows=%s path=%s",
                year_value,
                month_value,
                len(payload),
                out_file,
            )
            written_paths.append(out_file)

        return written_paths

    def read_range(self, start_utc: datetime, end_utc: datetime) -> pd.DataFrame:
        start = self._to_utc_timestamp(start_utc)
        end = self._to_utc_timestamp(end_utc)
        if end < start:
            raise ValueError("end_utc must be >= start_utc")

        periods = pd.period_range(start=start, end=end, freq="M")
        frames: list[pd.DataFrame] = []
        for period in periods:
            file_path = self.config.normalized_month_file(period.year, period.month)
            if file_path.exists():
                frames.append(pd.read_parquet(file_path))
            else:
                logger.warning("Missing normalized ERA5 parquet for %s: %s", str(period), file_path)

        if not frames:
            raise FileNotFoundError("No normalized ERA5 parquet found for requested period")

        df = pd.concat(frames, ignore_index=True)
        df["date"] = pd.to_datetime(df["date"], utc=True)
        df = df.set_index("date").sort_index()
        df = df[(df.index >= start) & (df.index <= end)]
        if df.empty:
            raise ValueError("No ERA5 rows in requested date range after filtering")
        return df

    @staticmethod
    def _floor_from_values(values: np.ndarray, target: float) -> float:
        sorted_values = np.sort(np.unique(values.astype(float)))
        if len(sorted_values) == 0:
            raise ValueError("Cannot floor against empty coordinate values")
        idx = np.searchsorted(sorted_values, target, side="right") - 1
        if idx < 0:
            idx = 0
        return float(sorted_values[idx])

    def get_point_series(
        self,
        latitude: float,
        longitude: float,
        start_utc: datetime,
        end_utc: datetime,
        selector: str = "floor_1p5",
        tz_out: str | None = None,
    ) -> pd.DataFrame:
        if selector != "floor_1p5":
            raise ValueError(f"Unsupported ERA5 selector: {selector}")

        df = self.read_range(start_utc=start_utc, end_utc=end_utc).copy()
        df["longitude_norm"] = normalize_longitude(df["longitude"].to_numpy())

        lat_floor = self._floor_from_values(df["latitude"].to_numpy(), float(latitude))
        lon_target = float(normalize_longitude(np.array([longitude]))[0])
        lon_floor = self._floor_from_values(df["longitude_norm"].to_numpy(), lon_target)

        mask = np.isclose(df["latitude"].to_numpy(), lat_floor) & np.isclose(
            df["longitude_norm"].to_numpy(), lon_floor
        )
        out = df.loc[
            mask,
            ["latitude", "longitude", "temperature_C", "vitesse_vent_kmh", "direction_vent"],
        ].copy()
        if out.empty:
            raise ValueError(
                f"No ERA5 data found for floored cell lat={lat_floor}, lon={lon_floor} "
                f"from point lat={latitude}, lon={longitude}"
            )

        out = out.sort_index()
        out.index.name = "date"
        if tz_out:
            out = convert_timezone(out, tz_out)
        else:
            out = convert_timezone(out, "UTC")
        return out
