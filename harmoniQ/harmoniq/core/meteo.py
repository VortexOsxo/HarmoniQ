from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional
import pandas as pd
import logging
from harmoniq.db.schemas import PositionBase
import openmeteo_requests
import requests_cache
from retry_requests import retry
import numpy as np
from harmoniq import METEO_DATA_PATH
import math

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
        self.cache_session = requests_cache.CachedSession('.cache', expire_after=-1)
        self.retry_session = retry(self.cache_session, retries=5, backoff_factor=0.2)
        self.openmeteo = openmeteo_requests.Client(session=self.retry_session)
        
        # Load existing CSV data once
        try:
            self.existing_df = pd.read_csv(METEO_DATA_PATH)
            self.existing_df["date"] = pd.to_datetime(self.existing_df["date"])
        except Exception as e:
            print(f"⚠️ Impossible de charger data.csv : {e}")
            self.existing_df = None

    def haversine(self, lat1, lon1, lat2, lon2):
        R = 6371  # Radius of Earth in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        return 2 * R * math.asin(math.sqrt(a))

    def get_weather_data(self, Latitude, Longitude, start_date, end_date):
        url = "https://archive-api.open-meteo.com/v1/archive"
        params = {
            "latitude": Latitude,
            "longitude": Longitude,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": ["temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature", "precipitation", "rain", "snowfall", "snow_depth", "soil_temperature_0_to_7cm", "soil_temperature_7_to_28cm", "soil_temperature_28_to_100cm", "soil_temperature_100_to_255cm", "wind_speed_10m", "wind_speed_100m", "wind_direction_10m", "wind_direction_100m", "wind_gusts_10m", "weather_code", "pressure_msl", "surface_pressure", "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "et0_fao_evapotranspiration", "vapour_pressure_deficit", "soil_moisture_0_to_7cm", "soil_moisture_7_to_28cm", "soil_moisture_28_to_100cm", "soil_moisture_100_to_255cm"],
            "timezone": "America/New_York",
            "wind_speed_unit": "ms"
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
                inclusive="left"
            )
        }
        hourly_data["temperature_C"] = hourly_temperature_2m
        hourly_data["vitesse_vent_kmh"] = hourly_wind_speed_100m * 3.6
        hourly_data["direction_vent"] = hourly_wind_direction_100m
        hourly_data["pression"] = hourly_surface_pressure / 10

        return pd.DataFrame(data=hourly_data)

    def get_weather_or_nearest(self, Latitude, Longitude, start_date, end_date):
        print(f"🌍 Recherche météo pour {Latitude}, {Longitude} de {start_date} à {end_date}")

        if self.existing_df is None:
            print("❌ Pas de base de données locale, appel à l’API...")
            start_str = start_date.strftime("%Y-%m-%d")
            end_str = (end_date + timedelta(days=1)).strftime("%Y-%m-%d")
            return self.get_weather_data(Latitude, Longitude, start_str, end_str)

        # Trouver la station la plus proche
        unique_coords = self.existing_df[["lat", "lon"]].drop_duplicates()
        unique_coords["distance"] = unique_coords.apply(
            lambda row: self.haversine(Latitude, Longitude, row["lat"], row["lon"]), axis=1
        )
        nearest = unique_coords.sort_values("distance").iloc[0]

        if nearest["distance"] > 50:
            print(f"ℹ️ Station la plus proche à {nearest['distance']:.1f} km — appel API")
            return self.get_weather_data(Latitude, Longitude, start_date, end_date)

        print(f"✅ Utilisation de la station à {nearest['distance']:.1f} km")

        # Conversion des dates en UTC avec seulement 00h00 inclus pour la date de fin
        start = pd.to_datetime(start_date).tz_localize("UTC") if pd.to_datetime(start_date).tzinfo is None else pd.to_datetime(start_date)
        end = pd.to_datetime(end_date).tz_localize("UTC") if pd.to_datetime(end_date).tzinfo is None else pd.to_datetime(end_date)
        end = end.replace(hour=0, minute=0, second=0, microsecond=0)
        df_filtered = self.existing_df[
            (self.existing_df["lat"] == nearest["lat"]) &
            (self.existing_df["lon"] == nearest["lon"]) &
            (self.existing_df["date"] >= start) &
            (self.existing_df["date"] <= end)
        ].copy()
        # Supprimer doublons exacts sur la date
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
    ):
        self.position = position
        self.interpolate = interpolate
        self.data_type = data_type

        self.start_time = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
        self.end_time = (end_time or datetime.now()).replace(hour=0, minute=0, second=0, microsecond=0)
        if self.start_time == self.end_time:
            self.end_time += timedelta(days=1)

        self._granularity = granularity
        self._data = None
        self.meteo_client = Meteo()

        logger.info(
            f"WeatherHelper({self.position} de {self.start_time} à {self.end_time}, granularité={self.granularity})"
        )

    @property
    def granularity(self) -> str:
        return self._granularity.name.lower()

    @property
    def data(self) -> pd.DataFrame:
        if self._data is None:
            raise ValueError("Data not loaded")
        return self._data

    def load(self) -> pd.DataFrame:
        if self._data is not None:
            return self._data


        original_start = self.start_time
        original_end = self.end_time
        # Utilise 2024 comme année de fallback si simulation dans le futur
        if self.end_time.year > _REFERENCE_YEAR:
            self.start_time = self.start_time.replace(year=2024)
            self.end_time = self.end_time.replace(year=2024)

        # Open-Meteo demande un end_date exclusif => ajouter 1 jour
        df = self.meteo_client.get_weather_or_nearest(
            Latitude=self.position.latitude,
            Longitude=self.position.longitude,
            start_date=self.start_time,
            end_date=self.end_time
        )
        df["date"] = pd.to_datetime(df["date"], utc=True)
        df["date"] = df["date"].dt.tz_convert("UTC").dt.tz_localize(None)
        df = df.drop_duplicates(subset="date", keep="first").copy()
        df = df.set_index("date").sort_index()
        df["vitesse_vent_kmh"] *= 3.6  # Convertit de m/s à km/h
        # Applique la vraie année de test
        df.index = df.index.map(lambda ts: ts.replace(year=original_start.year))
        expected_range = pd.date_range(
            start=original_start,
            end=original_end,
            freq="h"
        )

        df = df.reindex(expected_range)

        self._data = df
        return df







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
