import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import os
import glob

from typing import List, Optional
from datetime import datetime, timedelta
import pandas as pd


from harmoniq.db import schemas, engine, CRUD
from harmoniq.db.CRUD import (
    create_data,
    read_all_data,
    read_multiple_by_id,
    read_data_by_id,
    update_data,
    delete_data,
    hydrate_model
)
from harmoniq.db.demande import (
    read_demande_data, 
    read_demande_data_sankey, 
    read_demande_data_temporal,
)
from harmoniq.core import meteo
from harmoniq.db.engine import get_db
from harmoniq.core.fausse_données import production_aleatoire

from harmoniq.modules.eolienne import InfraParcEolienne
from harmoniq.modules.reseau import InfraReseau
from harmoniq.modules.solaire import InfraSolaire
from harmoniq.modules.thermique import InfraThermique
from harmoniq.modules.nucleaire import InfraNucleaire
from harmoniq.modules.hydro import InfraHydro
import json

#Appel des modules de production énergétique, ainsi que d'autres modules, et crée des routes web pour chaque fonction CRUD et autre!

router = APIRouter(
    prefix="/api",
    responses={404: {"description": "Not found"}},
)

# Route de test
@router.get("/ping")
async def ping():
    return {"ping": "pong"}


#-----#-----#-----#-----#-----#  Creation des méthodes CRUD  #-----#-----#-----#-----#-----#

# Création des méthodes CRUD sur FastAPI
api_routers = {}

for sql_class, pydantic_classes in engine.sql_tables.items():
    table_name = sql_class.__name__
    table_name_lower = table_name.lower()

    response_class = pydantic_classes["response"]

    class_router = APIRouter(
        prefix=f"/{table_name_lower}",
        tags=[table_name],
    )
    api_routers[table_name_lower] = class_router

    # Define the endpoints within a closure
    def create_endpoints(sql_class, response_class, table_name_lower):
        @class_router.get(
            "",
            response_model=List[response_class],
            summary=f"Read all {table_name_lower}s",
        )
        async def read_all(db: Session = Depends(get_db)):
            result = await read_all_data(db, sql_class)
            return result

        @class_router.get(
            "/{item_id}",
            response_model=response_class,
            summary=f"Read a {table_name} by id",
        )
        async def read(item_id: int, db: Session = Depends(get_db)):
            result = await read_data_by_id(db, sql_class, item_id)
            if result is None:
                raise HTTPException(
                    status_code=404, detail=f"{table_name_lower} {item_id} not found"
                )
            return result

    # Call the closure to define the endpoints
    create_endpoints(sql_class, response_class, table_name_lower)

#-----#-----#-----#-----#-----#  Demande d'energie  #-----#-----#-----#-----#-----#

# Demande : permet de lire la demande d'energie
demande_router = APIRouter(
    prefix="/demande",
    tags=["Demande"],
    responses={404: {"description": "Not found"}},
)

@demande_router.post("/")
async def read_demande(
    scenario: schemas.ScenarioResponse,
    CUID: Optional[int] = None,
    db: Session = Depends(get_db),
):

    demande = await read_demande_data(scenario, CUID)
    return "ping"

@demande_router.post("/sankey")
async def read_demande_sankey(
    scenario: schemas.ScenarioResponse,
    CUID: Optional[int] = None,
    db: Session = Depends(get_db),
):

    demande = await read_demande_data_sankey(scenario, CUID)
    return demande

@demande_router.post("/temporal")
async def read_demande_temporal(
    scenario: schemas.ScenarioResponse,
    CUID: Optional[int] = None,
    db: Session = Depends(get_db),
):

    demande = await read_demande_data_temporal(scenario, CUID)
    return demande


router.include_router(demande_router)

#-----#-----#-----#-----#-----#  Lecture de la météo  #-----#-----#-----#-----#-----#

meteo_router = APIRouter(
    prefix="/meteo",
    tags=["Meteo"],
    responses={404: {"description": "Not found"}},
)

@meteo_router.post("/get_data")
def get_meteo_data(
    latitude: float,
    longitude: float,
    interpolate: bool,
    start_time: datetime,
    granularity: int,
    end_time: Optional[datetime] = None,
):
    try:
        granularity = meteo.Granularity(granularity)
    except ValueError:
        raise HTTPException(status_code=400, detail="Granularity must be 1 or 2")

    helper = meteo.WeatherHelper(
        position=schemas.PositionBase(latitude=latitude, longitude=longitude),
        interpolate=interpolate,
        start_time=start_time,
        end_time=end_time,
        granularity=granularity,
    )
    helper.load()
    csv_buffer = helper.data.to_csv()
    return StreamingResponse(
        csv_buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=weather_data.csv"},
    )

router.include_router(meteo_router)

#-----#-----#-----#-----#-----#  Infra Specific  #-----#-----#-----#-----#-----#

PRODUCTION_MAPPING = {
    "eolienneparc": (InfraParcEolienne, schemas.EolienneParc),
    "solaire": (InfraSolaire, schemas.Solaire),
    "thermique": (InfraThermique, schemas.Thermique),
    "nucleaire": (InfraNucleaire, schemas.Nucleaire),
    "hydro": (InfraHydro, schemas.Hydro),
}

def get_infra_object(infra_type, payload):
    if infra_type not in PRODUCTION_MAPPING:
        raise HTTPException(400, f"Unsupported infra: '{infra_type}'")

    infra_class, infra_schema = PRODUCTION_MAPPING[infra_type]

    sql_model_instance = hydrate_model(infra_schema, payload.infra_payload)
    return infra_class(sql_model_instance)

@router.post("/production/{infra_type}")
async def calculer_production(
    infra_type: str, 
    payload: schemas.InfraSimulationPayload
):
    scenario = hydrate_model(schemas.Scenario, payload.scenario)
    infra = get_infra_object(infra_type, payload)
    infra.charger_scenario(scenario)

    production: pd.DataFrame = infra.calculer_production()
    if production is None or production.empty:
        return []

    return json.loads(production.fillna(0).to_json(date_format='iso'))

@router.post("/cout/{infra_type}")
async def calculer_cout(
    infra_type: str, 
    payload: schemas.InfraSimulationPayload
):
    scenario = hydrate_model(schemas.Scenario, payload.scenario)
    infra = get_infra_object(infra_type, payload)
    infra.charger_scenario(scenario)
    results = {
        'cout_annuel': infra.calculer_cout_pas_de_temps(timedelta(days=365)),
        'cout_construction': infra.calculer_cout_construction(),
    }
    return results


#-----#-----#-----#-----#-----#  Fake Data  #-----#-----#-----#-----#-----#

faker_router = APIRouter(
    prefix="/faker",
    tags=["Faker"],
    responses={404: {"description": "Not found"}},
)


@faker_router.post("/production")
async def get_production_aleatoire(scenario: schemas.ScenarioResponse):

    production = await asyncio.to_thread(production_aleatoire, scenario)
    return production


router.include_router(faker_router)

#-----#-----#-----#-----#-----#  Production : Reseau  #-----#-----#-----#-----#-----#

reseau_router = APIRouter(
    prefix="/reseau",
    tags=["Reseau"],
    responses={404: {"description": "Not found"}},
)

@reseau_router.post("/production")
async def calculer_production_reseau(payload: schemas.ReseauSimulationPayload, is_journalier: bool = False):    
    scenario = payload.scenario
    infra_group = payload.infra_group
    
    infra_reseau = InfraReseau(infra_group)
    infra_reseau.charger_scenario(scenario)

    production = await infra_reseau.calculer_production(infra_group, is_journalier)
    if production.empty:
        raise HTTPException(status_code=500, detail="Calcul de production échoué")
    
    production_json = production.reset_index().rename(columns={'index': 'timestamp'})
    if 'timestamp' in production_json.columns:
        production_json['timestamp'] = production_json['timestamp'].astype(str)
    
    response = {
        "metadata": {
            "scenario_id": payload.scenario.id,
            "infra_group_nom": infra_group.nom,
            "is_journalier": is_journalier,
            "timestamps": len(production)
        },
        "production": production_json.to_dict(orient='records')
    }
    
    return response

router.include_router(reseau_router)

#-----#-----#-----#-----#-----#  Ajout de toutes les routes  #-----#-----#-----#-----#-----#

for _, api_router in api_routers.items():
    router.include_router(api_router)
