import asyncio
import pandas as pd
from fastapi import HTTPException

from harmoniq.db import schemas
from harmoniq.db.CRUD import read_data_by_id

async def response_production(db, scenario_id, infra_id, infra_class, infra_schema):
    infra_task = read_data_by_id(db, infra_schema, infra_id)
    scenario_task = read_data_by_id(db, schemas.Scenario, scenario_id)

    eolienne_parc, scenario = await asyncio.gather(infra_task, scenario_task)
    if eolienne_parc is None:
        raise HTTPException(status_code=404, detail=f"Infrastructure {infra_schema.__name__} not found")

    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    infra = infra_class(eolienne_parc)
    infra.charger_scenario(scenario)

    production: pd.DataFrame = infra.calculer_production()
    production = production.fillna(0)

    return production