"""Tests for core/meteo_era5 modules — no network, no CDS API required."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
import xarray as xr
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from harmoniq.core.meteo_era5.config import Era5Config
from harmoniq.core.meteo_era5.transform import (
    normalize_longitude,
    compute_wind_speed_kmh,
    compute_wind_direction_deg,
    convert_timezone,
    normalize_era5_dataset,
    _resolve_coord_name,
    _resolve_var_name,
)
from harmoniq.core.meteo_era5.validate import (
    ValidationReport,
    validate_normalized_df,
    validate_raw_dataset,
)
from harmoniq.core.meteo_era5.cache import Era5Cache
from harmoniq.core.meteo_era5.provider import Era5WeatherProvider
from harmoniq.core.meteo_era5.cds_client import Era5CdsClient


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_minimal_ds(n_times=4, n_lat=2, n_lon=2) -> xr.Dataset:
    """Create a minimal ERA5-like xr.Dataset."""
    times = pd.date_range("2024-01-01", periods=n_times, freq="h", tz="UTC")
    lats = np.array([45.0, 46.5])[:n_lat]
    lons = np.array([-74.0, -72.5])[:n_lon]
    shape = (n_times, n_lat, n_lon)
    return xr.Dataset(
        {
            "u100": (["time", "latitude", "longitude"], np.ones(shape)),
            "v100": (["time", "latitude", "longitude"], np.ones(shape)),
            "t2m":  (["time", "latitude", "longitude"], np.full(shape, 280.0)),
        },
        coords={
            "time": times.values,
            "latitude": lats,
            "longitude": lons,
        },
    )


def _make_valid_normalized_df(n=24) -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=n, freq="h", tz="UTC", name="date")
    return pd.DataFrame({
        "latitude": 45.0,
        "longitude": -74.0,
        "temperature_C": 5.0,
        "vitesse_vent_kmh": 20.0,
        "direction_vent": 180.0,
    }, index=idx)


# ── Era5Config ────────────────────────────────────────────────────────────────

class TestEra5Config:
    def test_raw_month_file_contains_year_and_month(self):
        cfg = Era5Config()
        p = cfg.raw_month_file(2024, 3)
        assert "2024" in str(p) and "03" in str(p)

    def test_normalized_month_file_is_parquet(self):
        cfg = Era5Config()
        p = cfg.normalized_month_file(2024, 1)
        assert p.suffix == ".parquet"

    def test_normalized_month_file_contains_year(self):
        cfg = Era5Config()
        p = cfg.normalized_month_file(2023, 12)
        assert "2023" in str(p) and "12" in str(p)


# ── transform.py ──────────────────────────────────────────────────────────────

class TestNormalizeLongitude:
    def test_already_normalized(self):
        result = normalize_longitude(np.array([-73.5]))
        assert abs(result[0] - (-73.5)) < 1e-9

    def test_wraps_360_to_0(self):
        result = normalize_longitude(np.array([360.0]))
        assert abs(result[0]) < 1e-9

    def test_wraps_270_to_minus_90(self):
        result = normalize_longitude(np.array([270.0]))
        assert abs(result[0] - (-90.0)) < 1e-9

    def test_wraps_180_to_minus_180(self):
        result = normalize_longitude(np.array([180.0]))
        assert result[0] in (-180.0, 180.0)

    def test_negative_passthrough(self):
        result = normalize_longitude(np.array([-45.0]))
        assert abs(result[0] - (-45.0)) < 1e-9

    def test_vectorized(self):
        result = normalize_longitude(np.array([0.0, 90.0, 180.0, 270.0, 360.0]))
        assert result.shape == (5,)


class TestComputeWindSpeed:
    def test_pure_east(self):
        speed = compute_wind_speed_kmh(np.array([10.0]), np.array([0.0]))
        assert abs(speed[0] - 36.0) < 1e-6

    def test_zero_wind(self):
        assert compute_wind_speed_kmh(np.array([0.0]), np.array([0.0]))[0] == 0.0

    def test_pythagoras(self):
        u, v = 3.0, 4.0
        speed = compute_wind_speed_kmh(np.array([u]), np.array([v]))[0]
        assert abs(speed - 5.0 * 3.6) < 1e-6

    def test_always_positive(self):
        u = np.array([-5.0, 3.0, 0.0])
        v = np.array([4.0, -2.0, 0.0])
        assert np.all(compute_wind_speed_kmh(u, v) >= 0)


class TestComputeWindDirection:
    def test_north_wind(self):
        # North wind: from north (u=0, v=-10) → meteorological direction 0° (or 360°)
        deg = compute_wind_direction_deg(np.array([0.0]), np.array([-10.0]))[0]
        assert abs(deg) < 1 or abs(deg - 360.0) < 1

    def test_south_wind(self):
        # South wind: from south (u=0, v=+10) → meteorological direction 180°
        deg = compute_wind_direction_deg(np.array([0.0]), np.array([10.0]))[0]
        assert abs(deg - 180.0) < 1

    def test_output_in_0_360(self):
        u = np.random.uniform(-20, 20, 100)
        v = np.random.uniform(-20, 20, 100)
        dirs = compute_wind_direction_deg(u, v)
        assert np.all(dirs >= 0) and np.all(dirs < 360)


class TestConvertTimezone:
    def _df(self, tz=None):
        idx = pd.date_range("2024-01-01", periods=3, freq="h", tz=tz)
        return pd.DataFrame({"v": [1, 2, 3]}, index=idx)

    def test_naive_gets_localized_to_utc(self):
        df = self._df(tz=None)
        result = convert_timezone(df, "UTC")
        assert result.index.tz is not None

    def test_converts_to_target_tz(self):
        df = self._df(tz="UTC")
        result = convert_timezone(df, "America/Montreal")
        assert str(result.index.tz) == "America/Montreal"

    def test_raises_without_datetime_index(self):
        df = pd.DataFrame({"v": [1, 2]})
        with pytest.raises(TypeError):
            convert_timezone(df, "UTC")

    def test_no_tz_stays_utc(self):
        df = self._df(tz="UTC")
        result = convert_timezone(df, None)
        assert str(result.index.tz) == "UTC"


class TestResolveNames:
    def test_resolve_coord_found(self):
        ds = _make_minimal_ds()
        assert _resolve_coord_name(ds, ("latitude", "lat")) == "latitude"

    def test_resolve_coord_not_found_raises(self):
        ds = _make_minimal_ds()
        with pytest.raises(KeyError):
            _resolve_coord_name(ds, ("nonexistent",))

    def test_resolve_var_found(self):
        ds = _make_minimal_ds()
        assert _resolve_var_name(ds, ("u100", "wind_u")) == "u100"

    def test_resolve_var_not_found_raises(self):
        ds = _make_minimal_ds()
        with pytest.raises(KeyError):
            _resolve_var_name(ds, ("nonexistent",))


class TestNormalizeEra5Dataset:
    def test_returns_dataframe(self):
        ds = _make_minimal_ds()
        df = normalize_era5_dataset(ds)
        assert isinstance(df, pd.DataFrame)

    def test_has_required_columns(self):
        df = normalize_era5_dataset(_make_minimal_ds())
        assert {"latitude", "longitude", "temperature_C", "vitesse_vent_kmh", "direction_vent"}.issubset(df.columns)

    def test_temperature_converted_from_kelvin(self):
        df = normalize_era5_dataset(_make_minimal_ds())
        assert (df["temperature_C"] < 100).all()  # 280K → ~6.85°C

    def test_wind_speed_non_negative(self):
        df = normalize_era5_dataset(_make_minimal_ds())
        assert (df["vitesse_vent_kmh"] >= 0).all()

    def test_index_is_datetime(self):
        df = normalize_era5_dataset(_make_minimal_ds())
        assert isinstance(df.index, pd.DatetimeIndex)


# ── validate.py ───────────────────────────────────────────────────────────────

class TestValidationReport:
    def test_defaults(self):
        r = ValidationReport(ok=True)
        assert r.ok is True
        assert r.errors == []
        assert r.warnings == []
        assert r.metrics == {}

    def test_can_add_errors(self):
        r = ValidationReport(ok=False, errors=["bad thing"])
        assert len(r.errors) == 1


class TestValidateNormalizedDf:
    def test_valid_df_passes(self):
        df = _make_valid_normalized_df()
        start = pd.Timestamp("2024-01-01", tz="UTC")
        end = pd.Timestamp("2024-01-01 23:00:00", tz="UTC")
        report = validate_normalized_df(df, start, end)
        assert report.ok

    def test_missing_column_fails(self):
        df = _make_valid_normalized_df().drop(columns=["temperature_C"])
        report = validate_normalized_df(df, pd.Timestamp("2024-01-01", tz="UTC"), pd.Timestamp("2024-01-01 23:00:00", tz="UTC"))
        assert not report.ok
        assert any("Missing columns" in e for e in report.errors)

    def test_non_datetime_index_fails(self):
        df = _make_valid_normalized_df().reset_index(drop=True)
        report = validate_normalized_df(df, pd.Timestamp("2024-01-01", tz="UTC"), pd.Timestamp("2024-01-01 23:00:00", tz="UTC"))
        assert not report.ok

    def test_nan_in_column_fails(self):
        df = _make_valid_normalized_df()
        df.loc[df.index[0], "temperature_C"] = np.nan
        start = pd.Timestamp("2024-01-01", tz="UTC")
        end = pd.Timestamp("2024-01-01 23:00:00", tz="UTC")
        report = validate_normalized_df(df, start, end)
        assert not report.ok

    def test_missing_hours_detected(self):
        df = _make_valid_normalized_df(n=24)
        df = df.drop(df.index[5])  # remove one hour
        start = pd.Timestamp("2024-01-01", tz="UTC")
        end = pd.Timestamp("2024-01-01 23:00:00", tz="UTC")
        report = validate_normalized_df(df, start, end)
        assert not report.ok
        assert report.metrics["missing_hours_total"] > 0

    def test_row_count_in_metrics(self):
        df = _make_valid_normalized_df(n=24)
        start = pd.Timestamp("2024-01-01", tz="UTC")
        end = pd.Timestamp("2024-01-01 23:00:00", tz="UTC")
        report = validate_normalized_df(df, start, end)
        assert report.metrics["row_count"] == 24

    def test_duplicate_rows_detected(self):
        df = _make_valid_normalized_df(n=24)
        df = pd.concat([df, df.iloc[[0]]])  # add a duplicate row
        start = pd.Timestamp("2024-01-01", tz="UTC")
        end = pd.Timestamp("2024-01-01 23:00:00", tz="UTC")
        report = validate_normalized_df(df, start, end)
        assert not report.ok
        assert report.metrics["duplicate_row_count"] > 0


class TestValidateRawDataset:
    def test_valid_dataset_passes(self):
        ds = _make_minimal_ds()
        report = validate_raw_dataset(ds)
        assert report.ok

    def test_missing_time_fails(self):
        ds = _make_minimal_ds().drop_dims("time")
        report = validate_raw_dataset(ds)
        assert not report.ok
        assert any("time" in e.lower() for e in report.errors)

    def test_metrics_populated(self):
        ds = _make_minimal_ds(n_times=4, n_lat=2, n_lon=2)
        report = validate_raw_dataset(ds)
        assert report.metrics["time_count"] == 4
        assert report.metrics["lat_count"] == 2


# ── cache.py ──────────────────────────────────────────────────────────────────

class TestEra5CacheStatic:
    def test_floor_from_values_exact(self):
        vals = np.array([44.0, 45.5, 47.0])
        result = Era5Cache._floor_from_values(vals, 45.5)
        assert result == 45.5

    def test_floor_from_values_below(self):
        vals = np.array([44.0, 45.5, 47.0])
        result = Era5Cache._floor_from_values(vals, 46.0)
        assert result == 45.5

    def test_floor_from_values_before_first(self):
        vals = np.array([44.0, 45.5])
        result = Era5Cache._floor_from_values(vals, 43.0)
        assert result == 44.0

    def test_floor_from_values_empty_raises(self):
        with pytest.raises(ValueError):
            Era5Cache._floor_from_values(np.array([]), 45.0)

    def test_to_utc_timestamp_naive(self):
        ts = Era5Cache._to_utc_timestamp(datetime(2024, 1, 1, 12, 0))
        assert ts.tzinfo is not None

    def test_to_utc_timestamp_aware(self):
        aware = datetime(2024, 6, 1, tzinfo=timezone.utc)
        ts = Era5Cache._to_utc_timestamp(aware)
        assert ts.year == 2024


class TestEra5CacheHasYear:
    def test_has_year_false_when_dir_missing(self, tmp_path):
        cfg = Era5Config(normalized_dir=tmp_path)
        cache = Era5Cache(config=cfg)
        assert cache.has_year(2024) is False

    def test_has_year_true_when_parquet_present(self, tmp_path):
        cfg = Era5Config(normalized_dir=tmp_path)
        cache = Era5Cache(config=cfg)
        parquet_path = cfg.normalized_month_file(2024, 1)
        parquet_path.parent.mkdir(parents=True)
        pd.DataFrame({"a": [1]}).to_parquet(parquet_path)
        assert cache.has_year(2024) is True


class TestEra5CacheWriteRead:
    def test_write_monthly_parquet_creates_file(self, tmp_path):
        cfg = Era5Config(normalized_dir=tmp_path)
        cache = Era5Cache(config=cfg)
        idx = pd.date_range("2024-03-01", periods=24, freq="h", tz="UTC")
        df = pd.DataFrame({
            "latitude": 45.0, "longitude": -74.0,
            "temperature_C": 5.0, "vitesse_vent_kmh": 20.0, "direction_vent": 180.0,
        }, index=idx)
        paths = cache.write_monthly_parquet(df, year=2024)
        assert len(paths) == 1
        assert paths[0].exists()

    def test_write_requires_datetime_index(self, tmp_path):
        cfg = Era5Config(normalized_dir=tmp_path)
        cache = Era5Cache(config=cfg)
        df = pd.DataFrame({"a": [1, 2]})
        with pytest.raises(TypeError):
            cache.write_monthly_parquet(df, year=2024)

    def test_read_range_raises_when_no_files(self, tmp_path):
        cfg = Era5Config(normalized_dir=tmp_path)
        cache = Era5Cache(config=cfg)
        with pytest.raises(FileNotFoundError):
            cache.read_range(datetime(2024, 1, 1), datetime(2024, 1, 31))

    def test_read_range_raises_on_inverted_dates(self, tmp_path):
        cfg = Era5Config(normalized_dir=tmp_path)
        cache = Era5Cache(config=cfg)
        with pytest.raises(ValueError):
            cache.read_range(datetime(2024, 6, 1), datetime(2024, 1, 1))


# ── provider.py ───────────────────────────────────────────────────────────────

class TestEra5ProviderStatic:
    def test_to_utc_timestamp_naive(self):
        ts = Era5WeatherProvider._to_utc_timestamp(datetime(2024, 1, 1))
        assert ts.tz is not None

    def test_to_utc_timestamp_aware(self):
        ts = Era5WeatherProvider._to_utc_timestamp(datetime(2024, 1, 1, tzinfo=timezone.utc))
        assert ts.year == 2024

    def test_year_bounds_utc_start(self):
        start, end = Era5WeatherProvider._year_bounds_utc(2024)
        assert start.month == 1 and start.day == 1 and start.hour == 0

    def test_year_bounds_utc_end(self):
        _, end = Era5WeatherProvider._year_bounds_utc(2024)
        assert end.month == 12 and end.day == 31 and end.hour == 23

    def test_years_for_range_single(self):
        s = pd.Timestamp("2024-03-01", tz="UTC")
        e = pd.Timestamp("2024-11-01", tz="UTC")
        assert Era5WeatherProvider._years_for_range(s, e) == [2024]

    def test_years_for_range_multi(self):
        s = pd.Timestamp("2023-01-01", tz="UTC")
        e = pd.Timestamp("2025-12-31", tz="UTC")
        assert Era5WeatherProvider._years_for_range(s, e) == [2023, 2024, 2025]

    def test_get_weather_point_raises_inverted_dates(self):
        provider = Era5WeatherProvider(
            cache=MagicMock(), downloader=MagicMock()
        )
        with pytest.raises(ValueError, match="End date"):
            provider.get_weather_point(45.0, -73.0, datetime(2024, 6, 1), datetime(2024, 1, 1))


# ── cds_client.py ─────────────────────────────────────────────────────────────

class TestEra5CdsClient:
    def test_raises_import_error_without_cdsapi(self):
        client = Era5CdsClient("reanalysis-era5-single-levels")
        with patch.dict("sys.modules", {"cdsapi": None}):
            with pytest.raises((ImportError, TypeError)):
                client._get_client()

    def test_retrieve_creates_parent_dir(self, tmp_path):
        client = Era5CdsClient("reanalysis-era5-single-levels")
        mock_cds = MagicMock()
        client._client = mock_cds
        target = tmp_path / "subdir" / "file.nc"
        client.retrieve({}, target)
        assert target.parent.exists()
        mock_cds.retrieve.assert_called_once()
