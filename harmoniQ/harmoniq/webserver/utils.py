import asyncio
import pandas as pd
from fastapi import HTTPException

from harmoniq.db import schemas
from harmoniq.db.CRUD import read_data_by_id, hydrate_model

async def response_production(db, scenario_id, infra_payload, infra_class, infra_schema):
    scenario = await read_data_by_id(db, schemas.Scenario, scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    sql_model_instance = hydrate_model(infra_schema, infra_payload)
    
    if infra_schema.__name__ == 'Hydro':
        if getattr(sql_model_instance, 'type_barrage', None) != "Fil de l'eau":
            raise HTTPException(
                status_code=400, detail="Production calculation is only available for run-of-river dams"
            )

    infra = infra_class(sql_model_instance)
    infra.charger_scenario(scenario)

    production: pd.DataFrame = infra.calculer_production()
    production = production.fillna(0)

    return production