from sqlalchemy import Table
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from harmoniq.db import schemas

# CRUD.py : Ce fichier contient des fonctions utilitaires pour effectuer des opérations CRUD (Create, Read, Update, Delete) sur les tables SQLAlchemy.
# Ces fonctions sont conçues pour être génériques et peuvent être utilisées pour n'importe quelle table de la base de données.
# They are designed to be generic and can be used for any table in the database.

def hydrate_model(model_class, infra_pydantic_obj):
    if infra_pydantic_obj is None:
        return None
        
    model_kwargs = {}
    
    if hasattr(infra_pydantic_obj, "model_dump"):
         infra_dict = infra_pydantic_obj.model_dump()
    elif hasattr(infra_pydantic_obj, "dict"):
        infra_dict = infra_pydantic_obj.dict()
    elif isinstance(infra_pydantic_obj, dict):
        infra_dict = infra_pydantic_obj
    else:
        infra_dict = getattr(infra_pydantic_obj, "__dict__", {})

    for column in model_class.__table__.columns:
        col_name = column.name
        if col_name in infra_dict:
            model_kwargs[col_name] = infra_dict[col_name]
            
    if "puissance_nominale" in infra_dict and "puissance_nominal" not in model_kwargs:
        model_kwargs["puissance_nominal"] = infra_dict["puissance_nominale"]

    if "nom" not in model_kwargs and "nom" in infra_dict:
        model_kwargs["nom"] = infra_dict["nom"]
        
    return model_class(**model_kwargs)


async def read_all_data(db: Session, table: Table):
    return db.query(table).all()


async def create_data(db: Session, table: Table, data: BaseModel):
    payload = data.model_dump(exclude_unset=True)
    db_data = table(**payload)
    db.add(db_data)
    db.commit()
    db.refresh(db_data)
    return db_data


# This function is used to read data from the database by its ID, reads everything.
async def read_data_by_id(db: Session, table: Table, id: int):
    return db.query(table).filter(table.id == id).first()

# This function is used to read multiple data from the database by their IDs.
async def read_multiple_by_id(db: Session, table: Table, ids: List[int]):
    return db.query(table).filter(table.id.in_(ids)).all()

# This function is used to update data in the database by its ID.
async def update_data(db: Session, table: Table, id: int, data: BaseModel):
    db_data = db.query(table).filter(table.id == id).first()
    if db_data is None:
        return None
    payload = data.model_dump(exclude_unset=True)

    for key, value in payload.items():
        setattr(db_data, key, value)
    db.commit()
    db.refresh(db_data)
    return db_data

# This function is used to delete data from the database by its ID.
async def delete_data(db: Session, table: Table, id: int):
    db_data = db.query(table).filter(table.id == id).first()
    if db_data is None:
        return None
    db.delete(db_data)
    db.commit()
    return {"message": f"Instance of {table.__name__} deleted successfully"}

# Async fixers

async def read_all_bus_async(db: Session):
    return await read_all_data(db, schemas.Bus)

async def read_all_line_async(db: Session):
    return await read_all_data(db, schemas.Line)

async def read_all_line_type_async(db: Session):
    return await read_all_data(db, schemas.LineType)
