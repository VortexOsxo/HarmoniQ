from __future__ import annotations

import logging
from datetime import datetime

import pandas as pd

from harmoniq.core.meteo_era5.cache import Era5Cache
from harmoniq.core.meteo_era5.config import Era5Config
from harmoniq.core.meteo_era5.downloader import Era5MonthlyDownloader
from harmoniq.core.meteo_era5.transform import concat_monthly_netcdf, normalize_era5_dataset
from harmoniq.core.meteo_era5.validate import validate_normalized_df, validate_raw_dataset

import threading

logger = logging.getLogger("harmoniq.meteo.era5.provider")


class Era5WeatherProvider:
    _cache_lock = threading.Lock()

    def __init__(
        self,
        config: Era5Config | None = None,
        cache: Era5Cache | None = None,
        downloader: Era5MonthlyDownloader | None = None,
    ):
        self.config = config or Era5Config()
        self.cache = cache or Era5Cache(config=self.config)
        self.downloader = downloader or Era5MonthlyDownloader(config=self.config)

    @staticmethod
    def _to_utc_timestamp(value: datetime) -> pd.Timestamp:
        ts = pd.Timestamp(value)
        if ts.tzinfo is None:
            ts = ts.tz_localize("UTC")
        else:
            ts = ts.tz_convert("UTC")
        return ts

    @staticmethod
    def _year_bounds_utc(year: int) -> tuple[pd.Timestamp, pd.Timestamp]:
        return (
            pd.Timestamp(f"{year}-01-01 00:00:00", tz="UTC"),
            pd.Timestamp(f"{year}-12-31 23:00:00", tz="UTC"),
        )

    def ensure_year_cached(self, year: int = 2024, force_download: bool = False) -> None:
        if self.cache.has_year(year) and not force_download:
            return

        with self._cache_lock:
            if self.cache.has_year(year) and not force_download:
                return

            logger.info("Building ERA5 cache for year=%s (locked)", year)
            raw_paths = self.downloader.download_year(year=year, force=force_download)
            ds = concat_monthly_netcdf(raw_paths)

            raw_report = validate_raw_dataset(ds)
            if not raw_report.ok:
                raise ValueError(f"Raw ERA5 validation failed: {raw_report.errors}")

            normalized_df = normalize_era5_dataset(ds)
            start_utc, end_utc = self._year_bounds_utc(year)
            normalized_report = validate_normalized_df(normalized_df, start_utc=start_utc, end_utc=end_utc)
            if not normalized_report.ok:
                raise ValueError(f"Normalized ERA5 validation failed: {normalized_report.errors}")

            self.cache.write_monthly_parquet(normalized_df, year=year)
            logger.info("ERA5 cache build complete for year=%s", year)

    @staticmethod
    def _years_for_range(start_utc: pd.Timestamp, end_utc: pd.Timestamp) -> list[int]:
        return list(range(start_utc.year, end_utc.year + 1))

    def get_weather_point(
        self,
        latitude: float,
        longitude: float,
        start: datetime,
        end: datetime,
        tz_out: str | None = None,
    ) -> pd.DataFrame:
        start_utc = self._to_utc_timestamp(start)
        end_utc = self._to_utc_timestamp(end)
        if end_utc < start_utc:
            raise ValueError("End date must be >= start date")

        for year in self._years_for_range(start_utc, end_utc):
            self.ensure_year_cached(year=year)

        df = self.cache.get_point_series(
            latitude=latitude,
            longitude=longitude,
            start_utc=start_utc.to_pydatetime(),
            end_utc=end_utc.to_pydatetime(),
            selector="floor_1p5",
            tz_out=tz_out,
        )
        expected_cols = ["latitude", "longitude", "temperature_C", "vitesse_vent_kmh", "direction_vent"]
        return df[expected_cols].sort_index()
