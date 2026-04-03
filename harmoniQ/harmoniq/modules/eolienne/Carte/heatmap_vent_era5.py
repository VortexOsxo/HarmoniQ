from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import matplotlib
import numpy as np
import xarray as xr
from shapely.geometry import box

from harmoniq.modules.eolienne.Carte.Carte import load_quebec_geometry

matplotlib.use("Agg")
import matplotlib.pyplot as plt


TARGET_YEAR = 2024
TARGET_MONTH = 5

BASE_DIR = Path(__file__).resolve().parents[4]
NC_PATH = (
    BASE_DIR
    / "data"
    / "meteo"
    / "era5"
    / "raw"
    / f"year={TARGET_YEAR}"
    / f"month={TARGET_MONTH:02d}"
    / f"era5_qc_{TARGET_YEAR}_{TARGET_MONTH:02d}.nc"
)
OUT_PNG = (
    BASE_DIR
    / "harmoniq"
    / "modules"
    / "eolienne"
    / "plot"
    / f"heatmap_vent_era5_{TARGET_YEAR}_{TARGET_MONTH:02d}.png"
)


def validate_inputs(nc_path: Path, month: int, ds: xr.Dataset) -> None:
    if month < 1 or month > 12:
        raise ValueError(f"TARGET_MONTH must be in [1..12], got {month}")
    if not nc_path.exists():
        raise FileNotFoundError(f"ERA5 NetCDF file not found: {nc_path}")
    required_vars = {"u100", "v100"}
    missing_vars = required_vars.difference(ds.data_vars)
    if missing_vars:
        raise ValueError(f"Missing variables in NetCDF: {sorted(missing_vars)}")
    if "valid_time" not in ds.dims:
        raise ValueError("Missing required dimension 'valid_time' in NetCDF")
    for coord_name in ("latitude", "longitude"):
        if coord_name not in ds.coords:
            raise ValueError(f"Missing required coordinate '{coord_name}' in NetCDF")


def compute_monthly_mean_wind_kmh(ds: xr.Dataset) -> xr.DataArray:
    wind_speed_ms = np.sqrt(ds["u100"] ** 2 + ds["v100"] ** 2)
    wind_speed_kmh = wind_speed_ms * 3.6
    return wind_speed_kmh.mean(dim="valid_time")


def plot_heatmap(mean_wind_kmh: xr.DataArray, out_png: Path, year: int, month: int) -> None:
    lon = mean_wind_kmh["longitude"].values
    lat = mean_wind_kmh["latitude"].values
    z = mean_wind_kmh.values

    fig, ax = plt.subplots(figsize=(10, 8))
    mesh = ax.pcolormesh(lon, lat, z, shading="auto", cmap="viridis")
    cbar = plt.colorbar(mesh, ax=ax, shrink=0.85)
    cbar.set_label("Vitesse du vent moyenne (km/h)")

    quebec_geom = load_quebec_geometry()
    if quebec_geom is not None and not quebec_geom.empty:
        quebec_geom.boundary.plot(ax=ax, color="white", linewidth=1.2)
    else:
        quebec_bbox = gpd.GeoSeries([box(-80, 45, -57, 63)], crs="EPSG:4326")
        quebec_bbox.boundary.plot(ax=ax, color="white", linewidth=1.2)

    ax.set_xlim(-80, -57)
    ax.set_ylim(45, 63)
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_title(f"Heatmap vent ERA5 moyen - Quebec ({year}-{month:02d})")

    out_png.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    plt.savefig(out_png, dpi=200)
    plt.close(fig)


def main() -> None:
    ds = xr.open_dataset(NC_PATH)
    try:
        validate_inputs(NC_PATH, TARGET_MONTH, ds)
        valid_time_count = int(ds.sizes["valid_time"])
        print(
            f"ERA5 loaded: {NC_PATH.name} | valid_time={valid_time_count} | "
            f"lat={int(ds.sizes['latitude'])} lon={int(ds.sizes['longitude'])}"
        )
        mean_wind_kmh = compute_monthly_mean_wind_kmh(ds)
    finally:
        ds.close()

    plot_heatmap(mean_wind_kmh, OUT_PNG, TARGET_YEAR, TARGET_MONTH)
    print(f"Heatmap saved: {OUT_PNG}")


if __name__ == "__main__":
    main()
