import pytest
from sqlalchemy.orm import Session
from harmoniq.db.engine import engine, get_db
from harmoniq.db.schemas import SQLBase, EolienneParcCreate, TurbineModel
from harmoniq.db.CRUD import (
    create_eolienne_parc,
    read_eolienne_parc_by_id,
    read_all_eolienne_parc,
    update_eolienne_parc,
    delete_eolienne_parc,
)


@pytest.fixture(scope="module")
def db():
    SQLBase.metadata.create_all(bind=engine)
    db = next(get_db())
    yield db
    SQLBase.metadata.drop_all(bind=engine)
    db.close()

def test_create_eolienne_parc(db: Session):
    eolienne_parc = EolienneParcCreate(
        nom="Parc A",
        latitude=45.5017,
        longitude=-73.5673,
        nombre_eoliennes=10,
        capacite_total=50.0,
        hauteur_moyenne=80.0,
        modele_turbine=TurbineModel.MM92,
        puissance_nominal=2000.0,
    )
    result = create_eolienne_parc(db, eolienne_parc)
    assert result.id is not None


def test_read_all_eolienne_parc(db: Session):
    result = read_all_eolienne_parc(db)
    assert len(result) > 0


def test_read_eolienne_parc_by_id(db: Session):
    result = read_eolienne_parc_by_id(db, 1)
    assert result is not None
    assert result.id == 1

def test_update_eolienne_parc(db: Session):
    eolienne_parc = EolienneParcCreate(
        nom="Parc Updated",
        latitude=45.5017,
        longitude=-73.5673,
        nombre_eoliennes=10,
        capacite_total=50.0,
        hauteur_moyenne=85.0,
        modele_turbine=TurbineModel.MM92,
        puissance_nominal=2000.0,
    )
    result = update_eolienne_parc(db, 1, eolienne_parc)
    assert result.nom == "Parc Updated"


def test_delete_eolienne_parc(db: Session):
    result = delete_eolienne_parc(db, 1)
    assert result["message"] == "Instance of EolienneParc deleted successfully"
