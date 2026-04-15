import time
import random
import pytest
import asyncio
from datetime import datetime
from fastapi.testclient import TestClient
from harmoniq.webserver import app
from harmoniq.db import schemas, engine, CRUD

client = TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def setup_database_for_perf():
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

    infra_group = {
        "nom": "Infrastructures québécoises",
        "parc_eoliens": [schemas.EolienneParcResponse.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.EolienneParc)],
        "parc_solaires": [schemas.SolaireBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Solaire)],
        "central_hydroelectriques": [schemas.HydroBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Hydro)],
        "central_thermique": [schemas.ThermiqueBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Thermique)],
        "central_nucleaire": [schemas.NucleaireBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Nucleaire)],
    }
    return infra_group

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

@pytest.mark.performance
def test_performance_default_simulation():
    """Default 2035 scenario – production."""
    infra_group = asyncio.run(build_default_infra_group())
    payload = {"scenario": DEFAULT_SCENARIO, "infra_group": infra_group}

    start = time.perf_counter()
    response = client.post("/api/reseau/production", json=payload)
    duration = time.perf_counter() - start

    assert response.status_code == 200
    print(f"\n[PERF] Default production: {duration:.3f}s")
    assert duration <= 60

@pytest.mark.performance
def test_performance_random_long_term_simulation():
    """Randomized Jan–Dec 2035 dates – production."""
    start_date = datetime(2035, 1, random.randint(1, 31))
    end_date = datetime(2035, 12, random.randint(1, 31))

    scenario = {
        **DEFAULT_SCENARIO,
        "nom": f"Random ({start_date.date()} to {end_date.date()})",
        "date_de_debut": start_date.isoformat(),
        "date_de_fin": end_date.isoformat(),
    }

    infra_group = asyncio.run(build_default_infra_group())
    payload = {"scenario": scenario, "infra_group": infra_group}

    start = time.perf_counter()
    response = client.post("/api/reseau/production", json=payload)
    duration = time.perf_counter() - start

    assert response.status_code == 200
    print(f"\n[PERF] Random long-term production: {duration:.3f}s")
    assert duration <= 60

@pytest.mark.performance
def test_performance_extreme_scenario_simulation():
    """Cold weather + high consumption – production."""
    scenario = {
        **DEFAULT_SCENARIO,
        "nom": "Extreme (Cold + UB)",
        "weather": 3,
        "consomation": 2,
    }

    infra_group = asyncio.run(build_default_infra_group())
    payload = {"scenario": scenario, "infra_group": infra_group}

    start = time.perf_counter()
    response = client.post("/api/reseau/production", json=payload)
    duration = time.perf_counter() - start

    assert response.status_code == 200
    print(f"\n[PERF] Extreme production: {duration:.3f}s")
    assert duration <= 60

INFRA_TYPES = {
    "eolienneparc": (schemas.EolienneParcResponse, schemas.EolienneParc),
    "solaire": (schemas.SolaireBase, schemas.Solaire),
    "hydro": (schemas.HydroBase, schemas.Hydro),
    "thermique": (schemas.ThermiqueBase, schemas.Thermique),
    "nucleaire": (schemas.NucleaireBase, schemas.Nucleaire),
}

async def _first_infra(pydantic_model, sql_model):
    db = next(engine.get_db())
    rows = await CRUD.read_all_data(db, sql_model)
    if not rows:
        pytest.skip(f"No {sql_model.__tablename__} rows in test DB")
    return pydantic_model.model_validate(rows[0]).model_dump()

SINGLE_INFRA_ENDPOINTS = [
    ("production", "/api/production"),
    ("cout", "/api/cout"),
    ("emission", "/api/emission"),
]

@pytest.mark.performance
@pytest.mark.parametrize("infra_type", INFRA_TYPES.keys())
@pytest.mark.parametrize("endpoint_name,endpoint_prefix", SINGLE_INFRA_ENDPOINTS)
def test_performance_single_infra(infra_type, endpoint_name, endpoint_prefix):
    """Single infra – production / cost / emission."""
    pydantic_model, sql_model = INFRA_TYPES[infra_type]
    infra_payload = asyncio.run(_first_infra(pydantic_model, sql_model))
    payload = {"scenario": DEFAULT_SCENARIO, "infra_payload": infra_payload}

    url = f"{endpoint_prefix}/{infra_type}"
    start = time.perf_counter()
    response = client.post(url, json=payload)
    duration = time.perf_counter() - start

    assert response.status_code == 200
    print(f"\n[PERF] {infra_type} {endpoint_name}: {duration:.3f}s")
    if endpoint_name in ("cout", "emission"):
        threshold = 0.5
    else:
        production_thresholds = {
            "hydro": 1,
            "nucleaire": 1,
            "thermique": 1,
            "eolienneparc": 2,
            "solaire": 10,
        }
        threshold = production_thresholds[infra_type]
    assert duration <= threshold

@pytest.mark.performance
def test_performance_cost():
    """Network-wide cost calculation."""
    infra_group = asyncio.run(build_default_infra_group())
    payload = {"scenario": DEFAULT_SCENARIO, "infra_group": infra_group}

    start = time.perf_counter()
    response = client.post("/api/reseau/cout", json=payload)
    duration = time.perf_counter() - start

    assert response.status_code == 200
    print(f"\n[PERF] Cost: {duration:.3f}s")
    assert duration <= 0.5

@pytest.mark.performance
def test_performance_emission():
    """Network-wide emission calculation."""
    infra_group = asyncio.run(build_default_infra_group())
    payload = {"scenario": DEFAULT_SCENARIO, "infra_group": infra_group}

    start = time.perf_counter()
    response = client.post("/api/reseau/emission", json=payload)
    duration = time.perf_counter() - start

    assert response.status_code == 200
    print(f"\n[PERF] Emission: {duration:.3f}s")
    assert duration <= 0.5
