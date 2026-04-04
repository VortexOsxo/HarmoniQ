from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd
import xarray as xr

from harmoniq.core.meteo_era5.transform import (
    LAT_CANDIDATES,
    LON_CANDIDATES,
    T2M_CANDIDATES,
    TIME_CANDIDATES,
    U100_CANDIDATES,
    V100_CANDIDATES,
)


@dataclass
class ValidationReport:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metrics: dict[str, float | int] = field(default_factory=dict)


def _first_present(container: xr.Dataset, names: tuple[str, ...]) -> str | None:
    for name in names:
        if name in container.coords or name in container.dims or name in container.variables:
            return name
    return None


def _first_var(ds: xr.Dataset, names: tuple[str, ...]) -> str | None:
    for name in names:
        if name in ds.data_vars:
            return name
    return None


def validate_raw_dataset(ds: xr.Dataset) -> ValidationReport:
    report = ValidationReport(ok=True)

    time_name = _first_present(ds, TIME_CANDIDATES)
    lat_name = _first_present(ds, LAT_CANDIDATES)
    lon_name = _first_present(ds, LON_CANDIDATES)
    u_name = _first_var(ds, U100_CANDIDATES)
    v_name = _first_var(ds, V100_CANDIDATES)
    t_name = _first_var(ds, T2M_CANDIDATES)

    if not time_name:
        report.errors.append("Missing time coordinate")
    if not lat_name:
        report.errors.append("Missing latitude coordinate")
    if not lon_name:
        report.errors.append("Missing longitude coordinate")
    if not u_name:
        report.errors.append("Missing u100 variable")
    if not v_name:
        report.errors.append("Missing v100 variable")
    if not t_name:
        report.errors.append("Missing t2m variable")

    if report.errors:
        report.ok = False
        return report

    times = pd.to_datetime(ds[time_name].values, utc=True)
    report.metrics["time_count"] = int(times.size)
    report.metrics["lat_count"] = int(ds[lat_name].size)
    report.metrics["lon_count"] = int(ds[lon_name].size)

    dup_count = int(times.duplicated().sum())
    report.metrics["duplicate_time_count"] = dup_count
    if dup_count > 0:
        report.errors.append(f"Duplicate timestamps in raw dataset: {dup_count}")

    if len(times) > 1:
        expected = pd.date_range(times.min(), times.max(), freq="h", tz="UTC")
        missing = int(len(expected.difference(times)))
    else:
        missing = 0
    report.metrics["missing_hour_count"] = missing
    if missing > 0:
        report.errors.append(f"Missing timestamps in raw dataset: {missing}")

    nan_u = int(ds[u_name].isnull().sum().item())
    nan_v = int(ds[v_name].isnull().sum().item())
    nan_t = int(ds[t_name].isnull().sum().item())
    report.metrics["nan_u100"] = nan_u
    report.metrics["nan_v100"] = nan_v
    report.metrics["nan_t2m"] = nan_t
    if nan_u or nan_v or nan_t:
        report.errors.append(f"NaN found in raw dataset (u100={nan_u}, v100={nan_v}, t2m={nan_t})")

    report.ok = len(report.errors) == 0
    return report


def validate_normalized_df(
    df: pd.DataFrame,
    start_utc: pd.Timestamp,
    end_utc: pd.Timestamp,
) -> ValidationReport:
    report = ValidationReport(ok=True)
    required = {"latitude", "longitude", "temperature_C", "vitesse_vent_kmh", "direction_vent"}
    missing = required.difference(df.columns)
    if missing:
        report.errors.append(f"Missing columns: {sorted(missing)}")

    if not isinstance(df.index, pd.DatetimeIndex):
        report.errors.append("Index must be DatetimeIndex")

    if report.errors:
        report.ok = False
        return report

    work = df.copy()
    if work.index.tz is None:
        work.index = work.index.tz_localize("UTC")
    else:
        work.index = work.index.tz_convert("UTC")
    work = work.sort_index()

    report.metrics["row_count"] = int(len(work))
    report.metrics["lat_count"] = int(work["latitude"].nunique())
    report.metrics["lon_count"] = int(work["longitude"].nunique())

    for col in ("temperature_C", "vitesse_vent_kmh", "direction_vent"):
        nan_count = int(work[col].isna().sum())
        report.metrics[f"nan_{col}"] = nan_count
        if nan_count > 0:
            report.errors.append(f"NaN found in column {col}: {nan_count}")

    dedup = work.reset_index().duplicated(subset=["date", "latitude", "longitude"], keep=False)
    duplicate_count = int(dedup.sum())
    report.metrics["duplicate_row_count"] = duplicate_count
    if duplicate_count > 0:
        report.errors.append(f"Duplicate (time, lat, lon) rows: {duplicate_count}")

    expected_range = pd.date_range(start=start_utc, end=end_utc, freq="h", tz="UTC")
    missing_hours_total = 0
    per_cell_counts: list[int] = []
    for _, grp in work.groupby(["latitude", "longitude"], sort=False):
        unique_times = grp.index.drop_duplicates().sort_values()
        per_cell_counts.append(int(len(unique_times)))
        missing_hours_total += int(len(expected_range.difference(unique_times)))
    report.metrics["missing_hours_total"] = missing_hours_total
    if missing_hours_total > 0:
        report.errors.append(f"Missing hourly rows across grid cells: {missing_hours_total}")

    if per_cell_counts and len(set(per_cell_counts)) > 1:
        report.warnings.append("Time coverage differs between grid cells")

    report.ok = len(report.errors) == 0
    return report
