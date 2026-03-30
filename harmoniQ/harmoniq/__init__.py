from pathlib import Path
import os

# Pandas 3.0 utilise ArrowStringArray par défaut ("auto"), incompatible avec
# xarray/PyPSA 1.x qui attend des types NumPy natifs pour construire la
# matrice LP (TypeError: Invalid array type: ArrowStringArray → tous les
# chunks OPF échouent silencieusement, production = 0 partout).
# On force le stockage Python-natif ici pour tout le package.
import pandas as _pd
_pd.options.mode.string_storage = "python"
try:
    _pd.options.future.infer_string = False
except AttributeError:
    pass
del _pd

DEMANDE_PATH = Path(__file__).parent / "db" / "demande.db"
METEO_DATA_PATH = Path(__file__).parent / "db" / "meteo_data.csv"

if os.environ.get("HARMONIQ_TESTING") == "True":
    DB_PATH = Path(__file__).parent / "db" / "test_db.sqlite"
else:
    DB_PATH = Path(__file__).parent / "db" / "db.sqlite"
