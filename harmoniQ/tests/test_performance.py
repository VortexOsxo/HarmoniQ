import time
import pytest
import asyncio
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
