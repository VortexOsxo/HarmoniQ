from __future__ import annotations

import json
import logging
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from pyproj import Transformer

from harmoniq import PROJECT_ROOT
from harmoniq.core.meteo_era5 import Era5WeatherProvider
from harmoniq.core.meteo_era5.config import Era5Config
from harmoniq.core.meteo_era5.transform import normalize_longitude
from harmoniq.modules.eolienne.weibull.turbine_selection import (
    DEFAULT_ECONOMIC_SCENARIO,
    DEFAULT_END_YEAR,
    DEFAULT_MIN_SAMPLES,
    DEFAULT_PARK_MW,
    DEFAULT_PRICE_PER_MW,
    DEFAULT_START_YEAR,
    select_best_turbine_from_wind_samples,
    select_best_turbine_for_point,
)

DEFAULT_STAGE_A_BBOX_NWSE = (62.0, -79.8, 44.5, -57.0)
DEFAULT_STAGE_A_MESH_KM = 20.0
DEFAULT_STAGE_A_TOP_N = 10
DEFAULT_STAGE_A_PROJECTED_CRS = "EPSG:32198"
DEFAULT_QUEBEC_MRC_SHP = (
    PROJECT_ROOT
    / "harmoniq"
    / "modules"
    / "reseau"
    / "data"
    / "MRC_GROUPE_9"
    / "base_mrc_database.shp"
)

logger = logging.getLogger("harmoniq.eolienne.site_screening_stage_a")


def _default_stage_a_output_dir() -> Path:
    return PROJECT_ROOT / "harmoniq" / "modules" / "eolienne" / "plot" / "site_screening_stage_a"


@dataclass(frozen=True)
class SiteScreeningStageAConfig:
    start_year: int = DEFAULT_START_YEAR
    end_year: int = DEFAULT_END_YEAR
    mesh_km: float = DEFAULT_STAGE_A_MESH_KM
    top_n: int = DEFAULT_STAGE_A_TOP_N
    park_mw: float = DEFAULT_PARK_MW
    price_per_mw: float = DEFAULT_PRICE_PER_MW
    min_samples: int = DEFAULT_MIN_SAMPLES
    economic_scenario: str = DEFAULT_ECONOMIC_SCENARIO
    project_life_years: int | None = None
    bbox_nwse: tuple[float, float, float, float] = DEFAULT_STAGE_A_BBOX_NWSE
    projected_crs: str = DEFAULT_STAGE_A_PROJECTED_CRS
    enforce_quebec_boundary: bool = True
    output_dir: Path = _default_stage_a_output_dir()

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["output_dir"] = str(self.output_dir)
        return payload


def _validate_bbox_nwse(bbox_nwse: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    if len(bbox_nwse) != 4:
        raise ValueError("bbox_nwse must be a tuple (north, west, south, east)")
    north, west, south, east = map(float, bbox_nwse)
    if not np.isfinite([north, west, south, east]).all():
        raise ValueError("bbox_nwse values must be finite")
    if north <= south:
        raise ValueError("Invalid bbox_nwse: north must be > south")
    if east <= west:
        raise ValueError("Invalid bbox_nwse: east must be > west")
    return north, west, south, east


def _to_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, tuple):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, Path):
        return str(value)
    return value


def _load_quebec_boundary_polygon():
    try:
        import geopandas as gpd
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("geopandas is required to enforce Quebec boundary filtering") from exc

    shp_path = DEFAULT_QUEBEC_MRC_SHP
    if not shp_path.exists():
        raise FileNotFoundError(f"Quebec boundary shapefile not found: {shp_path}")

    mrc = gpd.read_file(shp_path)
    if mrc.empty:
        raise ValueError(f"Quebec boundary shapefile is empty: {shp_path}")
    if mrc.crs is None:
        mrc = mrc.set_crs("EPSG:4326")
    elif str(mrc.crs).lower() != "epsg:4326":
        mrc = mrc.to_crs("EPSG:4326")
    mrc = mrc.loc[mrc.geometry.notna()].copy()
    if mrc.empty:
        raise ValueError(f"Quebec boundary shapefile has no valid geometry: {shp_path}")

    province = mrc.dissolve().reset_index(drop=True)
    geom = province.geometry.iloc[0]
    if geom is None or geom.is_empty:
        raise ValueError("Dissolved Quebec boundary geometry is empty")
    return geom


def _filter_mesh_points_inside_quebec(mesh_points: pd.DataFrame) -> pd.DataFrame:
    if mesh_points.empty:
        return mesh_points.copy()
    required = {"latitude", "longitude"}
    missing = required.difference(mesh_points.columns)
    if missing:
        raise ValueError(f"mesh_points missing required columns for Quebec filter: {sorted(missing)}")

    try:
        import geopandas as gpd
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("geopandas is required to enforce Quebec boundary filtering") from exc

    shp_path = DEFAULT_QUEBEC_MRC_SHP
    if not shp_path.exists():
        raise FileNotFoundError(f"Quebec boundary shapefile not found: {shp_path}")

    mrc = gpd.read_file(shp_path)
    if mrc.empty:
        raise ValueError(f"Quebec boundary shapefile is empty: {shp_path}")
    if mrc.crs is None:
        mrc = mrc.set_crs("EPSG:4326")
    elif str(mrc.crs).lower() != "epsg:4326":
        mrc = mrc.to_crs("EPSG:4326")
    mrc = mrc.loc[mrc.geometry.notna(), ["geometry"]].copy()
    if mrc.empty:
        raise ValueError(f"Quebec boundary shapefile has no valid geometry: {shp_path}")

    points = mesh_points.reset_index(drop=False).rename(columns={"index": "_row_id"})
    points_gdf = gpd.GeoDataFrame(
        points[["_row_id"]],
        geometry=gpd.points_from_xy(
            points["longitude"].to_numpy(dtype=float),
            points["latitude"].to_numpy(dtype=float),
        ),
        crs="EPSG:4326",
    )
    joined = gpd.sjoin(points_gdf, mrc, how="inner", predicate="intersects")
    if joined.empty:
        return mesh_points.iloc[0:0].copy()
    keep_ids = np.sort(joined["_row_id"].astype(int).unique())
    out = mesh_points.iloc[keep_ids].copy().reset_index(drop=True)
    return out


def generate_metric_mesh_points(
    mesh_km: float = DEFAULT_STAGE_A_MESH_KM,
    bbox_nwse: tuple[float, float, float, float] = DEFAULT_STAGE_A_BBOX_NWSE,
    projected_crs: str = DEFAULT_STAGE_A_PROJECTED_CRS,
) -> pd.DataFrame:
    north, west, south, east = _validate_bbox_nwse(bbox_nwse)
    mesh_m = float(mesh_km) * 1000.0
    if mesh_m <= 0:
        raise ValueError("mesh_km must be > 0")

    to_projected = Transformer.from_crs("EPSG:4326", projected_crs, always_xy=True)
    to_wgs84 = Transformer.from_crs(projected_crs, "EPSG:4326", always_xy=True)

    corner_lons = np.array([west, west, east, east], dtype=float)
    corner_lats = np.array([south, north, south, north], dtype=float)
    corner_x, corner_y = to_projected.transform(corner_lons, corner_lats)

    min_x = float(np.min(corner_x))
    max_x = float(np.max(corner_x))
    min_y = float(np.min(corner_y))
    max_y = float(np.max(corner_y))

    x_start = math.floor(min_x / mesh_m) * mesh_m
    y_start = math.floor(min_y / mesh_m) * mesh_m
    x_end = math.ceil(max_x / mesh_m) * mesh_m
    y_end = math.ceil(max_y / mesh_m) * mesh_m

    xs = np.arange(x_start, x_end + 0.5 * mesh_m, mesh_m, dtype=float)
    ys = np.arange(y_start, y_end + 0.5 * mesh_m, mesh_m, dtype=float)
    if xs.size == 0 or ys.size == 0:
        raise ValueError("No mesh points generated from provided bbox")

    grid_x, grid_y = np.meshgrid(xs, ys)
    grid_ix, grid_iy = np.meshgrid(np.arange(xs.size), np.arange(ys.size))
    x_flat = grid_x.ravel()
    y_flat = grid_y.ravel()
    ix_flat = grid_ix.ravel().astype(int)
    iy_flat = grid_iy.ravel().astype(int)

    lon_flat, lat_flat = to_wgs84.transform(x_flat, y_flat)
    lon_flat = normalize_longitude(np.asarray(lon_flat, dtype=float))
    lat_flat = np.asarray(lat_flat, dtype=float)

    in_bbox = (
        (lat_flat >= south)
        & (lat_flat <= north)
        & (lon_flat >= west)
        & (lon_flat <= east)
    )
    if not np.any(in_bbox):
        raise ValueError("Generated projected mesh has no points inside bbox")

    out = pd.DataFrame(
        {
            "mesh_ix": ix_flat[in_bbox],
            "mesh_iy": iy_flat[in_bbox],
            "x_m": x_flat[in_bbox],
            "y_m": y_flat[in_bbox],
            "latitude": lat_flat[in_bbox],
            "longitude": lon_flat[in_bbox],
        }
    ).reset_index(drop=True)
    out.insert(0, "mesh_point_id", np.arange(1, len(out) + 1, dtype=int))
    return out


def load_era5_available_cells(
    start_year: int,
    end_year: int,
    config: Era5Config | None = None,
) -> pd.DataFrame:
    if end_year < start_year:
        raise ValueError(f"Invalid year interval: start_year={start_year} end_year={end_year}")

    era5_cfg = config or Era5Config()
    source_file: Path | None = None
    for year in range(int(start_year), int(end_year) + 1):
        for month in range(1, 13):
            candidate = era5_cfg.normalized_month_file(year=year, month=month)
            if candidate.exists():
                source_file = candidate
                break
        if source_file is not None:
            break

    if source_file is None:
        raise FileNotFoundError(
            f"No ERA5 normalized parquet found for years={start_year}-{end_year} under {era5_cfg.cache_dir}"
        )

    raw = pd.read_parquet(source_file, columns=["latitude", "longitude"]).drop_duplicates().copy()
    if raw.empty:
        raise ValueError(f"ERA5 coordinate table is empty in file: {source_file}")

    raw["era5_latitude"] = pd.to_numeric(raw["latitude"], errors="coerce")
    raw["era5_longitude"] = pd.to_numeric(raw["longitude"], errors="coerce")
    raw = raw.dropna(subset=["era5_latitude", "era5_longitude"]).copy()
    raw["era5_longitude_norm"] = normalize_longitude(raw["era5_longitude"].to_numpy(dtype=float))
    out = (
        raw[["era5_latitude", "era5_longitude", "era5_longitude_norm"]]
        .drop_duplicates()
        .sort_values(["era5_latitude", "era5_longitude_norm"], ascending=[True, True], kind="mergesort")
        .reset_index(drop=True)
    )
    if out.empty:
        raise ValueError("No valid ERA5 coordinates available after parsing")
    return out


def _iter_required_month_files(
    start_year: int,
    end_year: int,
    config: Era5Config,
) -> list[Path]:
    files: list[Path] = []
    for year in range(int(start_year), int(end_year) + 1):
        for month in range(1, 13):
            file_path = config.normalized_month_file(year=year, month=month)
            if not file_path.exists():
                raise FileNotFoundError(f"Missing ERA5 normalized monthly parquet: {file_path}")
            files.append(file_path)
    return files


def load_era5_wind_samples_by_cell(
    unique_cells: pd.DataFrame,
    start_year: int,
    end_year: int,
    config: Era5Config | None = None,
) -> dict[str, np.ndarray]:
    required = {"era5_cell_id", "era5_latitude", "era5_longitude"}
    missing = required.difference(unique_cells.columns)
    if missing:
        raise ValueError(f"unique_cells missing required columns: {sorted(missing)}")
    if unique_cells.empty:
        return {}

    era5_cfg = config or Era5Config()
    target = (
        unique_cells[["era5_cell_id", "era5_latitude", "era5_longitude"]]
        .drop_duplicates()
        .rename(columns={"era5_latitude": "latitude", "era5_longitude": "longitude"})
        .copy()
    )
    target["latitude"] = pd.to_numeric(target["latitude"], errors="coerce")
    target["longitude"] = pd.to_numeric(target["longitude"], errors="coerce")
    target = target.dropna(subset=["era5_cell_id", "latitude", "longitude"]).copy()
    if target.empty:
        raise ValueError("No valid target cells for loading ERA5 wind samples")

    sample_parts: dict[str, list[np.ndarray]] = {str(cid): [] for cid in target["era5_cell_id"].astype(str).tolist()}
    monthly_files = _iter_required_month_files(start_year=start_year, end_year=end_year, config=era5_cfg)
    total_files = len(monthly_files)
    for idx, file_path in enumerate(monthly_files, start=1):
        if idx == 1 or idx % 12 == 0 or idx == total_files:
            logger.info("Stage A loading ERA5 monthly files: %s/%s", idx, total_files)

        frame = pd.read_parquet(file_path, columns=["date", "latitude", "longitude", "vitesse_vent_kmh"])
        if frame.empty:
            continue

        frame["date"] = pd.to_datetime(frame["date"], utc=True, errors="coerce")
        frame["latitude"] = pd.to_numeric(frame["latitude"], errors="coerce")
        frame["longitude"] = pd.to_numeric(frame["longitude"], errors="coerce")
        frame["vitesse_vent_kmh"] = pd.to_numeric(frame["vitesse_vent_kmh"], errors="coerce")
        frame = frame.dropna(subset=["date", "latitude", "longitude", "vitesse_vent_kmh"]).copy()
        if frame.empty:
            continue
        frame = frame.loc[~((frame["date"].dt.month == 2) & (frame["date"].dt.day == 29))].copy()
        if frame.empty:
            continue

        merged = frame.merge(target, on=["latitude", "longitude"], how="inner")
        if merged.empty:
            continue

        merged["wind_ms"] = merged["vitesse_vent_kmh"].to_numpy(dtype=float) / 3.6
        for cell_id, part in merged.groupby("era5_cell_id", sort=False):
            arr = part["wind_ms"].to_numpy(dtype=float)
            arr = arr[np.isfinite(arr)]
            arr = arr[arr > 0.0]
            if arr.size > 0:
                sample_parts[str(cell_id)].append(arr)

    out: dict[str, np.ndarray] = {}
    for row in target.itertuples(index=False):
        cid = str(row.era5_cell_id)
        parts = sample_parts.get(cid, [])
        if not parts:
            raise ValueError(f"No ERA5 wind samples aggregated for cell {cid}")
        out[cid] = np.concatenate(parts)
    return out


def _floor_against_sorted_values(values_sorted: np.ndarray, targets: np.ndarray) -> np.ndarray:
    values = np.asarray(values_sorted, dtype=float)
    if values.size == 0:
        raise ValueError("Cannot floor against empty values_sorted")
    arr = np.asarray(targets, dtype=float)
    idx = np.searchsorted(values, arr, side="right") - 1
    idx[idx < 0] = 0
    return values[idx]


def _haversine_km(
    lat1: np.ndarray,
    lon1: np.ndarray,
    lat2: np.ndarray,
    lon2: np.ndarray,
) -> np.ndarray:
    r = 6371.0088
    p1 = np.radians(np.asarray(lat1, dtype=float))
    p2 = np.radians(np.asarray(lat2, dtype=float))
    dphi = p2 - p1
    dlambda = np.radians(np.asarray(lon2, dtype=float) - np.asarray(lon1, dtype=float))
    a = np.sin(dphi / 2.0) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlambda / 2.0) ** 2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return r * c


def map_points_to_era5_floor_cells(
    mesh_points: pd.DataFrame,
    era5_cells: pd.DataFrame,
) -> pd.DataFrame:
    if mesh_points.empty:
        raise ValueError("mesh_points cannot be empty")
    if era5_cells.empty:
        raise ValueError("era5_cells cannot be empty")

    required_mesh_cols = {"mesh_point_id", "mesh_ix", "mesh_iy", "x_m", "y_m", "latitude", "longitude"}
    missing_mesh = required_mesh_cols.difference(mesh_points.columns)
    if missing_mesh:
        raise ValueError(f"mesh_points missing required columns: {sorted(missing_mesh)}")

    required_era5_cols = {"era5_latitude", "era5_longitude", "era5_longitude_norm"}
    missing_era5 = required_era5_cols.difference(era5_cells.columns)
    if missing_era5:
        raise ValueError(f"era5_cells missing required columns: {sorted(missing_era5)}")

    out = mesh_points.copy()
    out["latitude"] = pd.to_numeric(out["latitude"], errors="coerce")
    out["longitude"] = pd.to_numeric(out["longitude"], errors="coerce")
    out = out.dropna(subset=["latitude", "longitude"]).copy()
    if out.empty:
        raise ValueError("mesh_points has no valid latitude/longitude values")
    out["longitude_norm"] = normalize_longitude(out["longitude"].to_numpy(dtype=float))

    lat_values = np.sort(era5_cells["era5_latitude"].astype(float).unique())
    lon_values = np.sort(era5_cells["era5_longitude_norm"].astype(float).unique())
    out["era5_latitude"] = _floor_against_sorted_values(lat_values, out["latitude"].to_numpy(dtype=float))
    out["era5_longitude_norm"] = _floor_against_sorted_values(lon_values, out["longitude_norm"].to_numpy(dtype=float))

    lookup = era5_cells[["era5_latitude", "era5_longitude_norm", "era5_longitude"]].drop_duplicates()
    out = out.merge(
        lookup,
        on=["era5_latitude", "era5_longitude_norm"],
        how="left",
        validate="many_to_one",
    )
    if out["era5_longitude"].isna().any():
        missing = int(out["era5_longitude"].isna().sum())
        raise ValueError(f"Could not resolve ERA5 longitude for {missing} mapped points")

    out["distance_to_cell_center_km"] = _haversine_km(
        lat1=out["latitude"].to_numpy(dtype=float),
        lon1=out["longitude"].to_numpy(dtype=float),
        lat2=out["era5_latitude"].to_numpy(dtype=float),
        lon2=out["era5_longitude"].to_numpy(dtype=float),
    )
    out["era5_cell_id"] = (
        out["era5_latitude"].map(lambda v: f"{float(v):.4f}")
        + "_"
        + out["era5_longitude"].map(lambda v: f"{float(v):.4f}")
    )
    return out


def select_representative_points_per_cell(mapped_points: pd.DataFrame) -> pd.DataFrame:
    if mapped_points.empty:
        return mapped_points.copy()
    required = {"era5_cell_id", "distance_to_cell_center_km", "mesh_point_id"}
    missing = required.difference(mapped_points.columns)
    if missing:
        raise ValueError(f"mapped_points missing required columns: {sorted(missing)}")

    out = mapped_points.sort_values(
        ["era5_cell_id", "distance_to_cell_center_km", "mesh_point_id"],
        ascending=[True, True, True],
        kind="mergesort",
    )
    out = out.drop_duplicates(subset=["era5_cell_id"], keep="first").reset_index(drop=True)
    return out


def _build_cell_screening_results(
    unique_cells: pd.DataFrame,
    config: SiteScreeningStageAConfig,
    provider: Era5WeatherProvider | None = None,
) -> pd.DataFrame:
    samples_by_cell: dict[str, np.ndarray] | None = None
    if provider is None:
        samples_by_cell = load_era5_wind_samples_by_cell(
            unique_cells=unique_cells,
            start_year=int(config.start_year),
            end_year=int(config.end_year),
        )

    rows: list[dict[str, Any]] = []
    total_cells = int(len(unique_cells))
    for idx, row in enumerate(unique_cells.itertuples(index=False), start=1):
        if idx == 1 or idx % 20 == 0 or idx == total_cells:
            logger.info("Stage A evaluating ERA5 cells: %s/%s", idx, total_cells)

        cell_lat = float(row.era5_latitude)
        cell_lon = float(row.era5_longitude)
        if provider is None:
            if samples_by_cell is None:
                raise RuntimeError("Internal error: samples_by_cell must be available when provider is None")
            selection = select_best_turbine_from_wind_samples(
                wind_samples_ms=samples_by_cell[str(row.era5_cell_id)],
                park_mw=float(config.park_mw),
                price_per_mw=float(config.price_per_mw),
                min_samples=int(config.min_samples),
                include_fallback_models=True,
                economic_scenario=str(config.economic_scenario),
                project_life_years=config.project_life_years,
                input_context={
                    "latitude": cell_lat,
                    "longitude": cell_lon,
                    "start_year": int(config.start_year),
                    "end_year": int(config.end_year),
                },
            )
        else:
            selection = select_best_turbine_for_point(
                latitude=cell_lat,
                longitude=cell_lon,
                start_year=int(config.start_year),
                end_year=int(config.end_year),
                park_mw=float(config.park_mw),
                price_per_mw=float(config.price_per_mw),
                min_samples=int(config.min_samples),
                provider=provider,
                include_fallback_models=True,
                economic_scenario=str(config.economic_scenario),
                project_life_years=config.project_life_years,
            )
        fit = selection["weibull_fit"]
        best_energy = selection["best_by_energy"]
        best_cost = selection["best_by_total_cost"]
        rows.append(
            {
                "era5_cell_id": str(row.era5_cell_id),
                "era5_latitude": cell_lat,
                "era5_longitude": cell_lon,
                "weibull_k": float(fit["k"]),
                "weibull_c": float(fit["c"]),
                "sample_count": int(fit["sample_count"]),
                "weibull_method": str(fit["method"]),
                "best_model_by_energy": str(best_energy["model_name"]),
                "annual_energy_park_mwh": float(best_energy["annual_energy_park_mwh"]),
                "total_annual_cost_per_mwh_cad": float(best_energy["total_annual_cost_per_mwh_cad"]),
                "om_cost_per_mwh_cad": float(best_energy["om_cost_per_mwh_cad"]),
                "best_model_rank_total_cost": int(best_energy["rank_total_cost"]),
                "best_model_rank_om_cost": int(best_energy["rank_om_cost"]),
                "best_model_by_total_cost": str(best_cost["model_name"]),
                "min_total_annual_cost_per_mwh_cad": float(best_cost["total_annual_cost_per_mwh_cad"]),
                "ranking_model_count": int(len(selection["ranking_multi_criteria"])),
            }
        )

    out = pd.DataFrame(rows)
    if out.empty:
        raise ValueError("No ERA5 cell result computed for Stage A screening")
    return out.sort_values(
        ["annual_energy_park_mwh", "total_annual_cost_per_mwh_cad", "era5_cell_id"],
        ascending=[False, True, True],
        kind="mergesort",
    ).reset_index(drop=True)


def run_site_screening_stage_a(
    config: SiteScreeningStageAConfig,
    provider: Era5WeatherProvider | None = None,
) -> dict[str, Any]:
    if int(config.top_n) <= 0:
        raise ValueError("top_n must be > 0")
    if float(config.mesh_km) <= 0:
        raise ValueError("mesh_km must be > 0")

    bbox_nwse = _validate_bbox_nwse(config.bbox_nwse)
    mesh_points = generate_metric_mesh_points(
        mesh_km=float(config.mesh_km),
        bbox_nwse=bbox_nwse,
        projected_crs=str(config.projected_crs),
    )
    mesh_point_count_before_quebec_filter = int(len(mesh_points))
    if bool(config.enforce_quebec_boundary):
        mesh_points = _filter_mesh_points_inside_quebec(mesh_points)
        if mesh_points.empty:
            raise ValueError("No 20 km mesh points remain inside Quebec boundary after filtering")

    era5_cells = load_era5_available_cells(start_year=int(config.start_year), end_year=int(config.end_year))
    mapped_points = map_points_to_era5_floor_cells(mesh_points=mesh_points, era5_cells=era5_cells)

    unique_cells = (
        mapped_points[["era5_cell_id", "era5_latitude", "era5_longitude"]]
        .drop_duplicates()
        .sort_values(["era5_cell_id"], kind="mergesort")
        .reset_index(drop=True)
    )
    cell_results = _build_cell_screening_results(unique_cells=unique_cells, config=config, provider=provider)

    representative_points = select_representative_points_per_cell(mapped_points)
    ranking = representative_points.merge(
        cell_results,
        on=["era5_cell_id", "era5_latitude", "era5_longitude"],
        how="inner",
        validate="one_to_one",
    )
    ranking = ranking.sort_values(
        ["annual_energy_park_mwh", "total_annual_cost_per_mwh_cad", "era5_cell_id"],
        ascending=[False, True, True],
        kind="mergesort",
    ).reset_index(drop=True)

    if ranking.empty:
        raise ValueError("No representative mapped point available for ranking")

    top_n = int(min(int(config.top_n), len(ranking)))
    top_sites = ranking.head(top_n).copy().reset_index(drop=True)
    top_sites.insert(0, "top_rank", np.arange(1, len(top_sites) + 1, dtype=int))

    summary = {
        "mesh_point_count_before_quebec_filter": mesh_point_count_before_quebec_filter,
        "mesh_point_count": int(len(mapped_points)),
        "era5_unique_cell_count": int(len(unique_cells)),
        "representative_point_count": int(len(representative_points)),
        "ranked_site_count": int(len(ranking)),
        "top_n_requested": int(config.top_n),
        "top_n_returned": int(len(top_sites)),
        "best_site": _to_jsonable(top_sites.iloc[0].to_dict()) if not top_sites.empty else None,
    }

    return {
        "input": {
            "start_year": int(config.start_year),
            "end_year": int(config.end_year),
            "mesh_km": float(config.mesh_km),
            "top_n": int(config.top_n),
            "park_mw": float(config.park_mw),
            "price_per_mw": float(config.price_per_mw),
            "min_samples": int(config.min_samples),
            "economic_scenario": str(config.economic_scenario),
            "project_life_years": int(config.project_life_years)
            if config.project_life_years is not None
            else None,
            "bbox_nwse": [float(v) for v in bbox_nwse],
            "projected_crs": str(config.projected_crs),
            "era5_grid_selector": "floor_1p5",
            "interpolation": "none",
            "sample_source": "provider" if provider is not None else "cache_preload_by_cell",
            "quebec_boundary_filter": bool(config.enforce_quebec_boundary),
            "quebec_boundary_source": str(DEFAULT_QUEBEC_MRC_SHP),
        },
        "mesh_points": mapped_points.to_dict(orient="records"),
        "cell_results": cell_results.to_dict(orient="records"),
        "top_sites": top_sites.to_dict(orient="records"),
        "summary": summary,
    }


def plot_top10_sites_stage_a(
    mesh_points_df: pd.DataFrame,
    top_sites_df: pd.DataFrame,
    output_png: Path,
    title: str = "Top 10 Wind Sites in Quebec - Stage A (20 km mesh, Weibull)",
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Patch

    output_png.parent.mkdir(parents=True, exist_ok=True)

    fig, axes = plt.subplots(
        1,
        2,
        figsize=(16, 8),
        constrained_layout=True,
        gridspec_kw={"width_ratios": [1.25, 1.0]},
    )
    ax_map, ax_bar = axes

    quebec_outline_plotted = False
    try:
        import geopandas as gpd

        shp_path = DEFAULT_QUEBEC_MRC_SHP
        if shp_path.exists():
            mrc = gpd.read_file(shp_path)
            if mrc.crs is not None and str(mrc.crs).lower() != "epsg:4326":
                mrc = mrc.to_crs("EPSG:4326")
            mrc = mrc.loc[mrc.geometry.notna()].copy()
            if not mrc.empty:
                province = mrc.dissolve().reset_index(drop=True)
                province.plot(ax=ax_map, color="#f4f6f8", edgecolor="#34495e", linewidth=1.8, zorder=0)
                mrc.boundary.plot(ax=ax_map, color="#9aa4af", linewidth=0.45, alpha=0.65, zorder=1)
                quebec_outline_plotted = True
    except Exception:
        quebec_outline_plotted = False

    if not quebec_outline_plotted:
        north, west, south, east = DEFAULT_STAGE_A_BBOX_NWSE
        ax_map.fill(
            [west, east, east, west, west],
            [south, south, north, north, south],
            color="#f4f6f8",
            alpha=0.55,
            zorder=0,
        )
        ax_map.plot(
            [west, east, east, west, west],
            [south, south, north, north, south],
            color="#34495e",
            linewidth=1.8,
            zorder=1,
        )

    if not mesh_points_df.empty:
        ax_map.scatter(
            mesh_points_df["longitude"],
            mesh_points_df["latitude"],
            s=8,
            color="#c2cad3",
            alpha=0.75,
            linewidths=0,
            label="20 km mesh",
            zorder=2,
        )

    top_sorted = top_sites_df.sort_values("top_rank", ascending=True, kind="mergesort").copy()
    if not top_sorted.empty:
        scatter = ax_map.scatter(
            top_sorted["longitude"],
            top_sorted["latitude"],
            s=70,
            c=top_sorted["top_rank"],
            cmap="viridis_r",
            edgecolors="black",
            linewidths=0.45,
            label="Top sites",
            zorder=4,
        )
        for row in top_sorted.itertuples(index=False):
            ax_map.annotate(
                f"#{int(row.top_rank)}",
                xy=(float(row.longitude), float(row.latitude)),
                xytext=(4, 4),
                textcoords="offset points",
                fontsize=8,
                color="black",
            )
        cbar = plt.colorbar(scatter, ax=ax_map, shrink=0.82)
        cbar.set_label("Top rank (1 = best)")

    ax_map.set_title("Panel A: Mesh map and top 10 representatives")
    ax_map.set_xlabel("Longitude")
    ax_map.set_ylabel("Latitude")
    ax_map.grid(alpha=0.2, linestyle="--")
    if not mesh_points_df.empty:
        x_min = float(mesh_points_df["longitude"].min())
        x_max = float(mesh_points_df["longitude"].max())
        y_min = float(mesh_points_df["latitude"].min())
        y_max = float(mesh_points_df["latitude"].max())
        pad_x = max((x_max - x_min) * 0.03, 0.2)
        pad_y = max((y_max - y_min) * 0.03, 0.2)
        ax_map.set_xlim(x_min - pad_x, x_max + pad_x)
        ax_map.set_ylim(y_min - pad_y, y_max + pad_y)
    map_legend_items = [
        Patch(facecolor="#f4f6f8", edgecolor="#34495e", label="Quebec boundary"),
        Patch(facecolor="#c2cad3", edgecolor="#c2cad3", label="20 km mesh"),
    ]
    ax_map.legend(handles=map_legend_items, loc="lower left", fontsize=8)

    if top_sorted.empty:
        ax_bar.text(0.5, 0.5, "No top sites available", ha="center", va="center", transform=ax_bar.transAxes)
    else:
        bars_df = top_sorted.sort_values("annual_energy_park_mwh", ascending=True, kind="mergesort").copy()
        labels = [
            f"#{int(rank)} ({float(lat):.2f}, {float(lon):.2f})"
            for rank, lat, lon in zip(
                bars_df["top_rank"],
                bars_df["latitude"],
                bars_df["longitude"],
            )
        ]
        ax_bar.barh(labels, bars_df["annual_energy_park_mwh"], color="#4e79a7", alpha=0.9)
        ax_bar.set_title("Panel B: Top 10 by annual park energy")
        ax_bar.set_xlabel("annual_energy_park_mwh")
        ax_bar.set_ylabel("Site")
        ax_bar.grid(axis="x", alpha=0.3, linestyle="--")

        energy_max = float(bars_df["annual_energy_park_mwh"].max())
        x_pad = max(energy_max * 0.005, 1.0)
        for row in bars_df.itertuples(index=False):
            label = (
                f"{float(row.annual_energy_park_mwh):,.0f} MWh | "
                f"{str(row.best_model_by_energy)} | "
                f"{float(row.total_annual_cost_per_mwh_cad):.1f} C$/MWh"
            )
            ax_bar.text(
                float(row.annual_energy_park_mwh) + x_pad,
                f"#{int(row.top_rank)} ({float(row.latitude):.2f}, {float(row.longitude):.2f})",
                label,
                va="center",
                fontsize=8,
            )

    fig.suptitle(title, fontsize=14)
    plt.savefig(output_png, dpi=220)
    plt.close(fig)


def export_site_screening_stage_a_outputs(
    result: dict[str, Any],
    output_dir: str | Path,
) -> dict[str, Path]:
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    mesh_points_csv = out_dir / "mesh_points_20km.csv"
    cell_screening_csv = out_dir / "era5_cell_screening.csv"
    top_sites_csv = out_dir / "top10_sites_stage_a.csv"
    summary_json = out_dir / "site_screening_stage_a_summary.json"
    plot_png = out_dir / "top10_sites_stage_a.png"

    mesh_df = pd.DataFrame(result["mesh_points"])
    cell_df = pd.DataFrame(result["cell_results"])
    top_df = pd.DataFrame(result["top_sites"])

    mesh_df.to_csv(mesh_points_csv, index=False, encoding="utf-8")
    cell_df.to_csv(cell_screening_csv, index=False, encoding="utf-8")
    top_df.to_csv(top_sites_csv, index=False, encoding="utf-8")

    summary_payload = {
        "input": result["input"],
        "summary": result["summary"],
    }
    with summary_json.open("w", encoding="utf-8") as fp:
        json.dump(_to_jsonable(summary_payload), fp, ensure_ascii=True, indent=2)

    plot_top10_sites_stage_a(mesh_points_df=mesh_df, top_sites_df=top_df, output_png=plot_png)

    return {
        "mesh_points_20km": mesh_points_csv,
        "era5_cell_screening": cell_screening_csv,
        "top10_sites_stage_a": top_sites_csv,
        "site_screening_stage_a_summary": summary_json,
        "top10_sites_stage_a_png": plot_png,
    }


__all__ = [
    "DEFAULT_STAGE_A_BBOX_NWSE",
    "DEFAULT_STAGE_A_MESH_KM",
    "DEFAULT_STAGE_A_PROJECTED_CRS",
    "DEFAULT_STAGE_A_TOP_N",
    "SiteScreeningStageAConfig",
    "export_site_screening_stage_a_outputs",
    "generate_metric_mesh_points",
    "load_era5_available_cells",
    "map_points_to_era5_floor_cells",
    "plot_top10_sites_stage_a",
    "run_site_screening_stage_a",
    "select_representative_points_per_cell",
]
