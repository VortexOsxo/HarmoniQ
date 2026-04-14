from __future__ import annotations

import calendar
import logging
import time
from pathlib import Path
from typing import Sequence

from harmoniq.core.meteo_era5.cds_client import Era5CdsClient
from harmoniq.core.meteo_era5.config import Era5Config

logger = logging.getLogger("harmoniq.meteo.era5.downloader")


class Era5MonthlyDownloader:
    def __init__(self, config: Era5Config | None = None, cds_client: Era5CdsClient | None = None):
        self.config = config or Era5Config()
        self.cds_client = cds_client or Era5CdsClient(dataset=self.config.dataset)

    def _build_month_request(self, year: int, month: int) -> dict[str, object]:
        day_count = calendar.monthrange(year, month)[1]
        return {
            "product_type": "reanalysis",
            "variable": [
                "100m_u_component_of_wind",
                "100m_v_component_of_wind",
                "2m_temperature",
            ],
            "year": f"{year}",
            "month": f"{month:02d}",
            "day": [f"{d:02d}" for d in range(1, day_count + 1)],
            "time": [f"{h:02d}:00" for h in range(24)],
            "area": list(self.config.area_nwse),
            "grid": [self.config.grid_deg[0], self.config.grid_deg[1]],
            "format": "netcdf",
        }

    @staticmethod
    def _is_valid_download(path: Path) -> bool:
        return path.exists() and path.stat().st_size > 1024

    def download_month(self, year: int, month: int, force: bool = False) -> Path:
        out_path = self.config.raw_month_file(year, month)
        if out_path.exists() and not force and self._is_valid_download(out_path):
            logger.info(
                "ERA5 monthly file already present (cache hit): year=%s month=%02d path=%s",
                year,
                month,
                out_path,
            )
            return out_path

        request = self._build_month_request(year, month)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = out_path.with_suffix(out_path.suffix + ".part")

        last_error: Exception | None = None
        for attempt in range(1, self.config.max_retries + 1):
            t0 = time.monotonic()
            try:
                logger.info(
                    "Downloading ERA5 month: year=%s month=%02d attempt=%s/%s",
                    year,
                    month,
                    attempt,
                    self.config.max_retries,
                )
                self.cds_client.retrieve(request=request, target=tmp_path)
                if not self._is_valid_download(tmp_path):
                    raise RuntimeError(f"Downloaded file invalid: {tmp_path}")
                tmp_path.replace(out_path)
                elapsed = time.monotonic() - t0
                logger.info(
                    "ERA5 month downloaded: year=%s month=%02d seconds=%.2f size_bytes=%s",
                    year,
                    month,
                    elapsed,
                    out_path.stat().st_size,
                )
                return out_path
            except Exception as exc:
                last_error = exc
                if tmp_path.exists():
                    tmp_path.unlink()
                wait_s = self.config.retry_backoff_s * (2 ** (attempt - 1))
                logger.warning(
                    "ERA5 month download failed: year=%s month=%02d attempt=%s error=%s retry_in_s=%.1f",
                    year,
                    month,
                    attempt,
                    exc,
                    wait_s,
                )
                if attempt < self.config.max_retries:
                    time.sleep(wait_s)

        raise RuntimeError(f"Failed to download ERA5 for {year}-{month:02d}: {last_error}")

    def download_year(
        self,
        year: int = 2024,
        months: Sequence[int] | None = None,
        force: bool = False,
    ) -> list[Path]:
        month_list = sorted(set(months or range(1, 13)))
        paths: list[Path] = []
        for month in month_list:
            if month < 1 or month > 12:
                raise ValueError(f"Invalid month value: {month}")
            paths.append(self.download_month(year=year, month=month, force=force))
        return paths
