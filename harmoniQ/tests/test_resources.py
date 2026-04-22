import os
import tracemalloc
import asyncio
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from harmoniq.webserver import app
from harmoniq.db import schemas, engine, CRUD
from harmoniq import DB_PATH

client = TestClient(app)

MAX_SERVER_RAM_MB = 8 * 1024  # 8 Go
MAX_SERVER_DISK_MB = 512      # 512 Mo

DEFAULT_SCENARIO = {
    "id": 1,
    "nom": "année 2035",
    "description": "Scénario de base pour l'année 2035",
    "date_de_debut": "2035-01-01T00:00:00",
    "date_de_fin": "2035-12-31T00:00:00",
    "pas_de_temps": "PT1H",
    "weather": 2,
    "consomation": 1,
}

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    from harmoniq.scripts.init_database import init_db, populate_db, check_if_empty

    init_db(reset=False)

    if check_if_empty():
        populate_db()

    db = next(engine.get_db())
    if not db.query(schemas.Nucleaire).first():
        db.add(schemas.Nucleaire(
            nom="Centrale nucléaire fictive",
            latitude=46.8,
            longitude=-71.2,
            puissance_nominal=1200,
            semaine_maintenance=20,
        ))
        db.commit()

async def build_default_infra_group():
    db = next(engine.get_db())

    return {
        "nom": "Infrastructures québécoises",
        "parc_eoliens": [schemas.EolienneParcResponse.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.EolienneParc)],
        "parc_solaires": [schemas.SolaireBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Solaire)],
        "central_hydroelectriques": [schemas.HydroBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Hydro)],
        "central_thermique": [schemas.ThermiqueBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Thermique)],
        "central_nucleaire": [schemas.NucleaireBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Nucleaire)],
    }

# This is the data that is moved to the postgres sql and isn't stored on the server
EXCLUDED_FILES = {"demande.db"}
EXCLUDED_DIRS = {"CSVs", "data"}

def _dir_size_mb(path: Path) -> float:
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
        for f in filenames:
            if f in EXCLUDED_FILES:
                continue
            total += os.path.getsize(os.path.join(dirpath, f))
    return total / (1024 * 1024)

@pytest.mark.resources
def test_server_disk_under_512mo():
    """Le serveur doit utiliser au maximum 512 Mo d'espace disque."""
    db_dir = DB_PATH.parent

    total_mb = _dir_size_mb(db_dir)

    print(f"\n[RESOURCE] Server disk usage: {total_mb:.1f} Mo (limit: {MAX_SERVER_DISK_MB} Mo) — {'PASS' if total_mb <= MAX_SERVER_DISK_MB else 'FAIL'}")
    assert total_mb <= MAX_SERVER_DISK_MB


@pytest.mark.resources
def test_server_ram_under_8go():
    """Le serveur doit utiliser au maximum 8 Go de RAM."""
    tracemalloc.start()

    infra_group = asyncio.run(build_default_infra_group())
    payload = {"scenario": DEFAULT_SCENARIO, "infra_group": infra_group}
    client.post("/api/reseau/production", json=payload)

    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    peak_mb = peak / (1024 * 1024)
    print(f"\n[RESOURCE] Server peak RAM: {peak_mb:.1f} Mo (limit: {MAX_SERVER_RAM_MB} Mo) — {'PASS' if peak_mb <= MAX_SERVER_RAM_MB else 'FAIL'}")
    assert peak_mb <= MAX_SERVER_RAM_MB
