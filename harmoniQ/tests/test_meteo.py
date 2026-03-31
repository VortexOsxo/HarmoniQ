from datetime import datetime
import pytest
from harmoniq.core.meteo import WeatherHelper
from harmoniq.db.schemas import PositionBase
from harmoniq.core.meteo import Granularity, EnergyType


@pytest.fixture
def position():
    return PositionBase(latitude=49.049334, longitude=-66.750423)


@pytest.fixture
def start_time():
    return datetime(2021, 1, 1)


@pytest.fixture
def end_time():
    return datetime(2021, 3, 31)


def test_weather_helper_initialization(position, start_time, end_time):
    weather = WeatherHelper(
        position, True, start_time, end_time, EnergyType.NONE, Granularity.HOURLY
    )
    assert weather.position == position
    assert weather.interpolate is True
    assert weather.start_time == start_time
    assert weather.end_time == end_time
    assert weather.data_type == EnergyType.NONE
    assert weather.granularity == "hourly"

def test_weather_helper_load_data(position, start_time, end_time):
    weather = WeatherHelper(position, True, start_time, end_time, EnergyType.NONE, Granularity.HOURLY)
    weather.load()
    assert weather.data is not None

def test_weather_helper_no_data_loaded(position, start_time, end_time):
    weather = WeatherHelper(
        position, True, start_time, end_time, EnergyType.NONE, Granularity.HOURLY
    )
    with pytest.raises(ValueError):
        _ = weather.data

def test_weather_helper_interpolation(position, start_time, end_time):
    w_no = WeatherHelper(position, False, start_time, end_time, EnergyType.NONE, Granularity.HOURLY)
    w_no.load()

    w_yes = WeatherHelper(position, True, start_time, end_time, EnergyType.NONE, Granularity.HOURLY)
    w_yes.load()

    # Colonnes candidates (certaines peuvent ne pas exister selon la source météo)
    candidate_cols = [
        "temperature_C",
        "precipitation_mm",
        "pluie_mm",
        "neige_cm",
        "vitesse_vent_kmh",
        "direction_vent",
        "pressure_msl",
        "pression",
    ]

    cols = [c for c in candidate_cols if c in w_no.data.columns and c in w_yes.data.columns]
    assert cols, f"Aucune colonne commune trouvée. Colonnes: {list(w_no.data.columns)}"

    na_no = w_no.data[cols].isna().sum().sum()
    na_yes = w_yes.data[cols].isna().sum().sum()

    assert na_yes <= na_no