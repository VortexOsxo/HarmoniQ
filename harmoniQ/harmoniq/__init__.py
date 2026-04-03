from pathlib import Path
import os

DEMANDE_PATH = Path(__file__).parent / "db" / "demande.db"
METEO_DATA_PATH = Path(__file__).parent / "db" / "meteo_data.csv"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ERA5_DATA_PATH = PROJECT_ROOT / "data" / "meteo" / "era5"
ERA5_RAW_PATH = ERA5_DATA_PATH / "raw"
ERA5_CACHE_PATH = ERA5_DATA_PATH / "cache"

if os.environ.get("HARMONIQ_TESTING") == "True":
    DB_PATH = Path(__file__).parent / "db" / "test_db.sqlite"
else:
    DB_PATH = Path(__file__).parent / "db" / "db.sqlite"
