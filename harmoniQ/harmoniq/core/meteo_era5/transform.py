from __future__ import annotations

from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd
import xarray as xr


TIME_CANDIDATES = ("time", "valid_time")
LAT_CANDIDATES = ("latitude", "lat")
LON_CANDIDATES = ("longitude", "lon")
U100_CANDIDATES = ("u100", "100m_u_component_of_wind")
V100_CANDIDATES = ("v100", "100m_v_component_of_wind")
T2M_CANDIDATES = ("t2m", "2m_temperature")


def _resolve_coord_name(ds: xr.Dataset, candidates: Sequence[str]) -> str:
    for name in candidates:
        if name in ds.coords or name in ds.dims or name in ds.variables:
            return name
    raise KeyError(f"Coordinate not found among: {candidates}")


def _resolve_var_name(ds: xr.Dataset, candidates: Sequence[str]) -> str:
    for name in candidates:
        if name in ds.data_vars:
            return name
    raise KeyError(f"Variable not found among: {candidates}")


def normalize_longitude(lon: np.ndarray | pd.Series) -> np.ndarray:
    values = np.asarray(lon, dtype=float)
    return ((values + 180.0) % 360.0) - 180.0


def concat_monthly_netcdf(paths: Sequence[Path]) -> xr.Dataset:
    if not paths:
        raise ValueError("No NetCDF file paths provided for concatenation")

    sorted_paths = sorted(Path(p) for p in paths)
    datasets: list[xr.Dataset] = []
    for path in sorted_paths:
        ds = xr.open_dataset(path)
        rename_map: dict[str, str] = {}
        time_name = _resolve_coord_name(ds, TIME_CANDIDATES)
        lat_name = _resolve_coord_name(ds, LAT_CANDIDATES)
        lon_name = _resolve_coord_name(ds, LON_CANDIDATES)
        if time_name != "time":
            rename_map[time_name] = "time"
        if lat_name != "latitude":
            rename_map[lat_name] = "latitude"
        if lon_name != "longitude":
            rename_map[lon_name] = "longitude"
        if rename_map:
            ds = ds.rename(rename_map)
        datasets.append(ds)

    combined = xr.concat(
        datasets,
        dim="time",
        data_vars="minimal",
        coords="minimal",
        compat="override",
        join="outer",
    )
    combined = combined.sortby("time")
    time_idx = pd.to_datetime(combined["time"].values, utc=True)
    _, keep_indices = np.unique(time_idx, return_index=True)
    combined = combined.isel(time=np.sort(keep_indices)).load()

    for ds in datasets:
        ds.close()

    return combined


def compute_wind_speed_kmh(u100: np.ndarray, v100: np.ndarray) -> np.ndarray:
    speed_ms = np.sqrt(np.asarray(u100, dtype=float) ** 2 + np.asarray(v100, dtype=float) ** 2)
    return speed_ms * 3.6


def compute_wind_direction_deg(u100: np.ndarray, v100: np.ndarray) -> np.ndarray:
    angle = 270.0 - np.degrees(np.arctan2(np.asarray(v100, dtype=float), np.asarray(u100, dtype=float)))
    return np.mod(angle, 360.0)


def normalize_era5_dataset(ds: xr.Dataset) -> pd.DataFrame:
    u_name = _resolve_var_name(ds, U100_CANDIDATES)
    v_name = _resolve_var_name(ds, V100_CANDIDATES)
    t_name = _resolve_var_name(ds, T2M_CANDIDATES)
    time_name = _resolve_coord_name(ds, TIME_CANDIDATES)
    lat_name = _resolve_coord_name(ds, LAT_CANDIDATES)
    lon_name = _resolve_coord_name(ds, LON_CANDIDATES)

    subset = ds[[u_name, v_name, t_name]].rename({u_name: "u100", v_name: "v100", t_name: "t2m"})
    rename_coords: dict[str, str] = {}
    if time_name != "time":
        rename_coords[time_name] = "time"
    if lat_name != "latitude":
        rename_coords[lat_name] = "latitude"
    if lon_name != "longitude":
        rename_coords[lon_name] = "longitude"
    if rename_coords:
        subset = subset.rename(rename_coords)

    df = subset.to_dataframe().reset_index()
    df["time"] = pd.to_datetime(df["time"], utc=True)
    df["latitude"] = df["latitude"].astype(float)
    df["longitude"] = normalize_longitude(df["longitude"].to_numpy())

    df["temperature_C"] = df["t2m"].astype(float) - 273.15
    df["vitesse_vent_kmh"] = compute_wind_speed_kmh(df["u100"].to_numpy(), df["v100"].to_numpy())
    df["direction_vent"] = compute_wind_direction_deg(df["u100"].to_numpy(), df["v100"].to_numpy())

    out = df[["time", "latitude", "longitude", "temperature_C", "vitesse_vent_kmh", "direction_vent"]]
    out = out.sort_values(["time", "latitude", "longitude"]).reset_index(drop=True)
    out = out.set_index("time")
    out.index.name = "date"
    return out


def convert_timezone(df: pd.DataFrame, tz: str | None) -> pd.DataFrame:
    out = df.copy()
    if not isinstance(out.index, pd.DatetimeIndex):
        raise TypeError("Expected DatetimeIndex on DataFrame")
    if out.index.tz is None:
        out.index = out.index.tz_localize("UTC")
    else:
        out.index = out.index.tz_convert("UTC")
    if tz:
        out.index = out.index.tz_convert(tz)
    return out
