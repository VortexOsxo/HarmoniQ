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
    """Initialise and populate the test database if it's empty."""
    from harmoniq.scripts.init_database import init_db, populate_db, check_if_empty
    
    init_db(reset=False)
    
    if check_if_empty():
        populate_db()

async def build_default_infra_group():
    """Queries the test DB to gather all default infrastructures like the client does."""
    db = next(engine.get_db())
    
    # Using correct Pydantic models from schemas.py
    infra_group = {
        "nom": "Infrastructures québécoises",
        "parc_eoliens": [schemas.EolienneParcResponse.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.EolienneParc)],
        "parc_solaires": [schemas.SolaireBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Solaire)],
        "central_hydroelectriques": [schemas.HydroBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Hydro)],
        "central_thermique": [schemas.ThermiqueBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Thermique)],
        "central_nucleaire": [schemas.NucleaireBase.model_validate(i).model_dump() for i in await CRUD.read_all_data(db, schemas.Nucleaire)],
    }
    return infra_group

@pytest.mark.performance
def test_performance_default_simulation():
    """
    Runs a single performance test using the test database, 
    matching the client's default scenario (année 2035) and infrastructures.
    """
    
    # Default Scenario from ScenariosService (année 2035)
    default_scenario = {
        "id": 1,
        "nom": "année 2035",
        "description": "Scénario de base pour l'année 2035",
        "date_de_debut": "2035-01-01T00:00:00",
        "date_de_fin": "2035-12-31T00:00:00",
        "pas_de_temps": "PT1H",
        "weather": 2, # Typical
        "consomation": 1, # Normal
    }
    
    # Get all infras from the test DB
    infra_group = asyncio.run(build_default_infra_group())
    
    payload = {
        "scenario": default_scenario,
        "infra_group": infra_group
    }
    
    print(f"\n[PERF] Starting simulation using TEST DATABASE for '{default_scenario['nom']}'")
    print(f"  - Infrastructures: {len(infra_group['parc_eoliens'])} wind, {len(infra_group['parc_solaires'])} solar, {len(infra_group['central_hydroelectriques'])} hydro")
    
    start = time.perf_counter()
    response = client.post("/api/reseau/production", json=payload)
    end = time.perf_counter()
    
    duration = end - start
    assert response.status_code == 200
    
    results = response.json()
    
    print(f"\n[PERF] Total Execution Time: {duration:.3f}s")
    assert duration <= 60

@pytest.mark.performance
def test_performance_random_long_term_simulation():
    """
    Runs a long term simulation with randomized start (January) 
    and end (December) dates to test varying loads.
    """
    # Random day in January (1-31)
    start_day = random.randint(1, 31)
    # Random day in December (1-31)
    end_day = random.randint(1, 31)
    
    start_date = datetime(2035, 1, start_day, 0, 0, 0)
    end_date = datetime(2035, 12, end_day, 0, 0, 0)
    
    scenario = {
        "id": 1,
        "nom": f"Randomized Long Term ({start_date.date()} to {end_date.date()})",
        "description": "Stress test with random dates",
        "date_de_debut": start_date.isoformat(),
        "date_de_fin": end_date.isoformat(),
        "pas_de_temps": "PT1H",
        "weather": 2, # Typical
        "consomation": 1, # Normal
    }
    
    # Get all infras from the test DB
    infra_group = asyncio.run(build_default_infra_group())
    
    payload = {
        "scenario": scenario,
        "infra_group": infra_group
    }
    
    print(f"\n[PERF] Starting random simulation: {scenario['nom']}")
    print(f"  - Duration: {(end_date - start_date).days} days")
    
    start = time.perf_counter()
    response = client.post("/api/reseau/production", json=payload)
    end = time.perf_counter()
    
    duration = end - start
    assert response.status_code == 200
    
    print(f"\n[PERF] Random Long Term Execution Time: {duration:.3f}s")
    assert duration <= 60

@pytest.mark.performance
def test_performance_extreme_scenario_simulation():
    """
    Runs a simulation with extreme weather (Cold) and conservative consumption (UB),
    measuring performance under a "Worst Case" scenario.
    """
    scenario = {
        "id": 1,
        "nom": "Extreme Scenario (Cold + UB)",
        "description": "Stress test with cold weather and high consumption",
        "date_de_debut": "2035-01-01T00:00:00",
        "date_de_fin": "2035-12-31T00:00:00",
        "pas_de_temps": "PT1H",
        "weather": 3, # Cold
        "consomation": 2, # UB / Conservateur
    }
    
    infra_group = asyncio.run(build_default_infra_group())
    payload = {"scenario": scenario, "infra_group": infra_group}
    
    print(f"\n[PERF] Starting extreme simulation: {scenario['nom']}")
    
    start = time.perf_counter()
    response = client.post("/api/reseau/production", json=payload)
    end = time.perf_counter()
    
    duration = end - start
    assert response.status_code == 200
    
    print(f"\n[PERF] Extreme Scenario Execution Time: {duration:.3f}s")
    assert duration <= 60
