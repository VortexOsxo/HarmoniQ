import pytest
from fastapi.testclient import TestClient

from harmoniq import ERA5_NORMALIZED_PATH
from harmoniq.webserver import app

client = TestClient(app)


def _has_era5_year_cache(year: int) -> bool:
    base = ERA5_NORMALIZED_PATH / f"year={year}"
    if not base.exists():
        return False
    return any(base.rglob("*.parquet"))


@pytest.mark.skipif(not _has_era5_year_cache(2024), reason="ERA5 cache year=2024 not available")
def test_wind_map_years_endpoint():
    response = client.get("/api/meteo/wind-map/years")
    assert response.status_code == 200
    payload = response.json()
    assert "years" in payload
    assert "default_year" in payload
    assert isinstance(payload["years"], list)
    assert payload["years"] == sorted(payload["years"])
    assert 2024 in payload["years"]
    assert payload["default_year"] == 2024


@pytest.mark.skipif(not _has_era5_year_cache(2024), reason="ERA5 cache year=2024 not available")
def test_wind_map_annual_endpoint_returns_cells():
    response = client.get("/api/meteo/wind-map/annual", params={"year": 2024})
    assert response.status_code == 200

    payload = response.json()
    assert payload["year"] == 2024
    assert payload["metric"] == "vitesse_vent_kmh_mean"
    assert "cells" in payload and isinstance(payload["cells"], list)
    assert len(payload["cells"]) > 0

    sample = payload["cells"][0]
    assert set(sample.keys()) == {"latitude", "longitude", "mean_wind_kmh"}
    assert isinstance(sample["mean_wind_kmh"], (float, int))

    assert payload["grid"]["lat_step_deg"] == 1.5
    assert payload["grid"]["lon_step_deg"] == 1.5
    assert payload["grid"]["lat_half_step_deg"] == 0.75
    assert payload["grid"]["lon_half_step_deg"] == 0.75
    assert payload["value_range"]["max"] >= payload["value_range"]["min"]


def test_wind_map_annual_endpoint_invalid_year():
    response = client.get("/api/meteo/wind-map/annual", params={"year": 1900})
    assert response.status_code == 404
    detail = response.json().get("detail", "")
    assert "year=1900" in detail
