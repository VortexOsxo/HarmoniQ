"""Tests for hydrate_model in db/CRUD.py (pure function, no DB session needed)."""
import pytest
from harmoniq.db.CRUD import hydrate_model
from harmoniq.db.schemas import EolienneParc, EolienneParcBase, TurbineModel


def _base_obj(**kwargs):
    defaults = dict(
        nom="Parc Test",
        latitude=45.5,
        longitude=-73.5,
        nombre_eoliennes=5,
        capacite_total=10.0,
        hauteur_moyenne=80.0,
        modele_turbine=TurbineModel.MM92,
        puissance_nominal=2000.0,
    )
    defaults.update(kwargs)
    return EolienneParcBase(**defaults)


class TestHydrateModelNone:
    def test_none_input_returns_none(self):
        assert hydrate_model(EolienneParc, None) is None


class TestHydrateModelDict:
    def test_dict_input_returns_instance(self):
        data = {"nom": "A", "latitude": 45.0, "longitude": -73.0, "puissance_nominal": 1.0}
        result = hydrate_model(EolienneParc, data)
        assert result is not None

    def test_float_coercion(self):
        data = {"puissance_nominal": "5", "latitude": 45.0, "longitude": -73.0}
        result = hydrate_model(EolienneParc, data)
        assert isinstance(result.puissance_nominal, float)

    def test_integer_coercion(self):
        data = {"nombre_eoliennes": "10", "latitude": 45.0, "longitude": -73.0}
        result = hydrate_model(EolienneParc, data)
        assert isinstance(result.nombre_eoliennes, int)

    def test_puissance_nominale_alias_maps_to_puissance_nominal(self):
        data = {"puissance_nominale": 15.0}
        result = hydrate_model(EolienneParc, data)
        assert result.puissance_nominal == 15.0

    def test_nom_fallback(self):
        data = {"nom": "FallbackNom"}
        result = hydrate_model(EolienneParc, data)
        assert result.nom == "FallbackNom"


class TestHydrateModelPydantic:
    def test_pydantic_input_returns_instance(self):
        obj = _base_obj()
        result = hydrate_model(EolienneParc, obj)
        assert result is not None

    def test_pydantic_nom_preserved(self):
        obj = _base_obj(nom="Mon Parc")
        result = hydrate_model(EolienneParc, obj)
        assert result.nom == "Mon Parc"

    def test_pydantic_float_fields(self):
        obj = _base_obj(puissance_nominal=3000.0)
        result = hydrate_model(EolienneParc, obj)
        assert isinstance(result.puissance_nominal, float)

    def test_pydantic_latitude_longitude(self):
        obj = _base_obj(latitude=48.0, longitude=-71.0)
        result = hydrate_model(EolienneParc, obj)
        assert result.latitude == 48.0
        assert result.longitude == -71.0
