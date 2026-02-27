import pandas as pd
from fastapi import HTTPException

from harmoniq.db import schemas
from harmoniq.db.CRUD import hydrate_model

async def response_production(scenario, infra_payload, infra_class, infra_schema):
    sql_model_instance = hydrate_model(infra_schema, infra_payload)
    scenario = hydrate_model(schemas.Scenario, scenario)
    
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