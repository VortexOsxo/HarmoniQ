from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
import logging
import math
from typing import TYPE_CHECKING, Optional

import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry

from harmoniq import METEO_DATA_PATH
from harmoniq.db.schemas import PositionBase

if TYPE_CHECKING:
    from harmoniq.core.meteo_era5 import Era5Config


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


class Granularity(Enum):
    DAILY = 2
    HOURLY = 1


class EnergyType(Enum):
    NONE = 0
    HYDRO = 1
    SOLAIRE = 2
    EOLIEN = 3


_CURRENT_YEAR = datetime.now().year
_REFERENCE_YEAR = 2024


class Meteo:
    def __init__(self):
        self.cache_session = requests_cache.CachedSession(".cache", expire_after=-1)
        self.retry_session = retry(self.cache_session, retries=5, backoff_factor=0.2)
        self.openmeteo = openmeteo_requests.Client(session=self.retry_session)
        try:
            self.existing_df = pd.read_csv(METEO_DATA_PATH)
            self.existing_df["date"] = pd.to_datetime(self.existing_df["date"])
        except Exception as exc:
            print(f"Impossible de charger data.csv : {exc}")
            self.existing_df = None

    @staticmethod
    def haversine(lat1, lon1, lat2, lon2):
        radius_km = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        return 2 * radius_km * math.asin(math.sqrt(a))

    def get_weather_data(self, latitude, longitude, start_date, end_date):
        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": [
                "temperature_2m",
                "relative_humidity_2m",
                "dew_point_2m",
                "apparent_temperature",
                "precipitation",
                "rain",
                "snowfall",
                "snow_depth",
                "soil_temperature_0_to_7cm",
                "soil_temperature_7_to_28cm",
                "soil_temperature_28_to_100cm",
                "soil_temperature_100_to_255cm",
                "wind_speed_10m",
                "wind_speed_100m",
                "wind_direction_10m",
                "wind_direction_100m",
                "wind_gusts_10m",
                "weather_code",
                "pressure_msl",
                "surface_pressure",
                "cloud_cover",
                "cloud_cover_low",
                "cloud_cover_mid",
                "cloud_cover_high",
                "et0_fao_evapotranspiration",
                "vapour_pressure_deficit",
                "soil_moisture_0_to_7cm",
                "soil_moisture_7_to_28cm",
                "soil_moisture_28_to_100cm",
                "soil_moisture_100_to_255cm",
            ],
            "timezone": "America/New_York",
            "wind_speed_unit": "ms",
        }
        responses = self.openmeteo.weather_api(url, params=params)
        response = responses[0]
        hourly = response.Hourly()
        hourly_temperature_2m = hourly.Variables(0).ValuesAsNumpy()
        hourly_wind_speed_100m = hourly.Variables(13).ValuesAsNumpy()
        hourly_wind_direction_100m = hourly.Variables(15).ValuesAsNumpy()
        hourly_surface_pressure = hourly.Variables(19).ValuesAsNumpy()

        hourly_data = {
            "date": pd.date_range(
                start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
                end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
                freq=pd.Timedelta(seconds=hourly.Interval()),
                inclusive="left",
            )
        }
        hourly_data["temperature_C"] = hourly_temperature_2m
        # Keep raw Open-Meteo wind speed in m/s here.
        # Conversion to km/h is handled once in WeatherHelper._load_from_openmeteo.
        hourly_data["vitesse_vent_kmh"] = hourly_wind_speed_100m
        hourly_data["__wind_unit"] = "ms"
        hourly_data["direction_vent"] = hourly_wind_direction_100m
        hourly_data["pression"] = hourly_surface_pressure / 10

        df = pd.DataFrame(data=hourly_data)
        df["date"] = df["date"] - pd.Timedelta(hours=4)
        return df

    def get_weather_or_nearest(self, latitude, longitude, start_date, end_date):
        print(f"Recherche meteo pour {latitude}, {longitude} de {start_date} a {end_date}")

        if self.existing_df is None:
            print("Pas de base de donnees locale, appel a l'API...")
            start_str = start_date.strftime("%Y-%m-%d")
            end_str = (end_date + timedelta(days=1)).strftime("%Y-%m-%d")
            return self.get_weather_data(latitude, longitude, start_str, end_str)

        unique_coords = self.existing_df[["lat", "lon"]].drop_duplicates()
        unique_coords["distance"] = unique_coords.apply(
            lambda row: self.haversine(latitude, longitude, row["lat"], row["lon"]),
            axis=1,
        )
        nearest = unique_coords.sort_values("distance").iloc[0]

        if nearest["distance"] > 50:
            print(f"Station la plus proche a {nearest['distance']:.1f} km - appel API")
            start_str = start_date.strftime("%Y-%m-%d")
            end_str = (end_date + timedelta(days=1)).strftime("%Y-%m-%d")
            return self.get_weather_data(latitude, longitude, start_str, end_str)

        print(f"Utilisation de la station a {nearest['distance']:.1f} km")
        start = pd.to_datetime(start_date)
        end = pd.to_datetime(end_date)
        if start.tzinfo is None:
            start = start.tz_localize("UTC")
        if end.tzinfo is None:
            end = end.tz_localize("UTC")
        end = end.replace(hour=0, minute=0, second=0, microsecond=0)

        df_filtered = self.existing_df[
            (self.existing_df["lat"] == nearest["lat"])
            & (self.existing_df["lon"] == nearest["lon"])
            & (self.existing_df["date"] >= start)
            & (self.existing_df["date"] <= end)
        ].copy()
        df_filtered["date"] = pd.to_datetime(df_filtered["date"], utc=True)
        df_filtered = df_filtered.sort_values("date")
        return df_filtered


class WeatherHelper:
    def __init__(
        self,
        position: PositionBase,
        interpolate: bool,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        data_type: EnergyType = EnergyType.NONE,
        granularity: Granularity = Granularity.HOURLY,
        weather_source: str = "openmeteo",
        timezone_out: Optional[str] = None,
        era5_config: Optional["Era5Config"] = None,
    ):
        self.position = position
        self.interpolate = interpolate
        self.data_type = data_type
        self.start_time = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
        self.end_time = (end_time or datetime.now()).replace(hour=0, minute=0, second=0, microsecond=0)
        if self.start_time == self.end_time:
            self.end_time += timedelta(days=1)

        self._granularity = granularity
        self._data: Optional[pd.DataFrame] = None
        self.meteo_client = Meteo()
        self.weather_source = weather_source.lower()
        self.timezone_out = timezone_out
        self.era5_config = era5_config
        if self.weather_source not in {"openmeteo", "era5"}:
            raise ValueError(f"Unsupported weather source: {self.weather_source}")

        logger.info(
            "WeatherHelper(position=%s start=%s end=%s granularity=%s source=%s)",
            self.position,
            self.start_time,
            self.end_time,
            self.granularity,
            self.weather_source,
        )

    @property
    def granularity(self) -> str:
        return self._granularity.name.lower()

    @property
    def data(self) -> pd.DataFrame:
        if self._data is None:
            raise ValueError("Data not loaded")
        return self._data

    @staticmethod
    def _remap_index_to_year_drop_feb29(df: pd.DataFrame, target_year: int) -> pd.DataFrame:
        if not isinstance(df.index, pd.DatetimeIndex):
            raise TypeError("Expected DatetimeIndex for weather dataframe")

        out = df.copy()
        # --- PATCH LEAP DAY GUARD START ---
        # We intentionally ignore Feb 29 when remapping reference-year weather data
        # (e.g., 2024 leap year) to non-leap scenario years (e.g., 2035).
        # This prevents: ValueError("day is out of range for month") on ts.replace(year=...).
        feb29_mask = (out.index.month == 2) & (out.index.day == 29)
        if feb29_mask.any():
            dropped_hours = int(feb29_mask.sum())
            logger.info(
                "Dropping leap-day rows before year remap: target_year=%s dropped_hours=%s",
                target_year,
                dropped_hours,
            )
            out = out.loc[~feb29_mask].copy()
        # --- PATCH LEAP DAY GUARD END ---
        out.index = out.index.map(lambda ts: ts.replace(year=target_year))
        return out

    @staticmethod
    def _normalize_openmeteo_wind_kmh(df: pd.DataFrame) -> pd.DataFrame:
        """
        Ensure Open-Meteo wind speed ends up in km/h exactly once.

        Preferred path:
        - if marker column ``__wind_unit`` exists, convert deterministically from that unit.
        Fallback path:
        - use distribution heuristic for legacy CSV rows without marker.
        """
        out = df.copy()
        if "vitesse_vent_kmh" not in out.columns:
            return out

        unit_marker = None
        if "__wind_unit" in out.columns:
            marker_values = out["__wind_unit"].dropna().astype(str).str.lower().unique()
            if len(marker_values) > 0:
                unit_marker = marker_values[0]

        if unit_marker in {"ms", "m/s"}:
            out["vitesse_vent_kmh"] = pd.to_numeric(out["vitesse_vent_kmh"], errors="coerce") * 3.6
            logger.info("Open-Meteo wind converted from m/s to km/h using explicit marker")
        elif unit_marker in {"kmh", "km/h"}:
            logger.info("Open-Meteo wind already in km/h (explicit marker)")
        else:
            # Legacy CSV fallback: infer likely unit from order of magnitude.
            s = pd.to_numeric(out["vitesse_vent_kmh"], errors="coerce").dropna()
            if not s.empty:
                q95 = float(s.quantile(0.95))
                vmax = float(s.max())
                likely_ms = q95 <= 30.0 and vmax <= 45.0
                if likely_ms:
                    out["vitesse_vent_kmh"] = pd.to_numeric(out["vitesse_vent_kmh"], errors="coerce") * 3.6
                    logger.info(
                        "Open-Meteo wind converted from m/s to km/h using heuristic (q95=%.2f, max=%.2f)",
                        q95,
                        vmax,
                    )
                else:
                    logger.info(
                        "Open-Meteo wind kept as km/h using heuristic (q95=%.2f, max=%.2f)",
                        q95,
                        vmax,
                    )
        if "__wind_unit" in out.columns:
            out = out.drop(columns=["__wind_unit"])
        return out

    def _load_from_era5(self) -> pd.DataFrame:
        from harmoniq.core.meteo_era5 import Era5WeatherProvider

        original_start = self.start_time
        original_end = self.end_time
        query_start = self.start_time
        query_end = self.end_time
        if query_end.year > _REFERENCE_YEAR:
            query_start = query_start.replace(year=_REFERENCE_YEAR)
            query_end = query_end.replace(year=_REFERENCE_YEAR)

        provider = Era5WeatherProvider(config=self.era5_config)
        df = provider.get_weather_point(
            latitude=self.position.latitude,
            longitude=self.position.longitude,
            start=query_start,
            end=query_end,
            tz_out=self.timezone_out,
        ).copy()

        if df.index.tz is not None:
            df.index = df.index.tz_localize(None)
        df = df[~df.index.duplicated(keep="first")].sort_index()

        if original_start.year != query_start.year:
            df = self._remap_index_to_year_drop_feb29(df, target_year=original_start.year)

        expected_range = pd.date_range(start=original_start, end=original_end, freq="h")
        df = df.reindex(expected_range)
        return df

    def _load_from_openmeteo(self) -> pd.DataFrame:
        original_start = self.start_time
        original_end = self.end_time
        if self.end_time.year > _REFERENCE_YEAR:
            self.start_time = self.start_time.replace(year=_REFERENCE_YEAR)
            self.end_time = self.end_time.replace(year=_REFERENCE_YEAR)

        df = self.meteo_client.get_weather_or_nearest(
            latitude=self.position.latitude,
            longitude=self.position.longitude,
            start_date=self.start_time,
            end_date=self.end_time,
        )
        df["date"] = pd.to_datetime(df["date"], utc=True)
        df["date"] = df["date"].dt.tz_convert("UTC").dt.tz_localize(None)
        df = df.drop_duplicates(subset="date", keep="first").copy()
        df = df.set_index("date").sort_index()
        df = self._normalize_openmeteo_wind_kmh(df)
        if original_start.year != self.start_time.year:
            df = self._remap_index_to_year_drop_feb29(df, target_year=original_start.year)
        expected_range = pd.date_range(start=original_start, end=original_end, freq="h")
        df = df.reindex(expected_range)
        return df

    def load(self) -> pd.DataFrame:
        if self._data is not None:
            return self._data

        if self.weather_source == "era5":
            self._data = self._load_from_era5()
        else:
            self._data = self._load_from_openmeteo()
        return self._data


if __name__ == "__main__":
    pos = PositionBase(latitude=45.80944, longitude=-73.43472)
    start_time = datetime(2024, 9, 1)
    end_time = datetime(2024, 9, 4)
    granularity = Granularity.HOURLY

    weather = WeatherHelper(
        pos,
        interpolate=True,
        start_time=start_time,
        end_time=end_time,
        data_type=EnergyType.EOLIEN,
        granularity=granularity,
    )
    print("#-----#-----#-----#-----#")
    print("Running the load method...")
    print("#-----#-----#-----#-----#")
    df = weather.load()
    print(df.head())
    print("#-----#-----#-----#-----#")
    print("Finished loading data.")
    print("#-----#-----#-----#-----#")
