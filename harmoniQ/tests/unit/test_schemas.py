import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock
from harmoniq.db.schemas import (
    ScenarioBase,
    EolienneParcBase,
    SolaireBase,
    ThermiqueBase,
    NucleaireBase,
    BusBase,
    TurbineModel,
    Weather,
    Consomation,
    TypeIntrantThermique,
    BusControlType,
    BusType,
    DateTimeString,
    TimeDeltaString,
)


class TestDateTimeString:
    def setup_method(self):
        self.decorator = DateTimeString()
        self.dialect = MagicMock()

    def test_bind_param_converts_datetime_to_iso_string(self):
        dt = datetime(2024, 6, 15, 12, 30, 0)
        result = self.decorator.process_bind_param(dt, self.dialect)
        assert result == "2024-06-15T12:30:00"

    def test_bind_param_none_returns_none(self):
        assert self.decorator.process_bind_param(None, self.dialect) is None

    def test_result_value_parses_iso_string(self):
        result = self.decorator.process_result_value("2024-06-15T12:30:00", self.dialect)
        assert result == datetime(2024, 6, 15, 12, 30, 0)

    def test_result_value_none_returns_none(self):
        assert self.decorator.process_result_value(None, self.dialect) is None

    def test_round_trip(self):
        dt = datetime(2023, 3, 21, 8, 0, 0)
        serialized = self.decorator.process_bind_param(dt, self.dialect)
        recovered = self.decorator.process_result_value(serialized, self.dialect)
        assert recovered == dt


class TestTimeDeltaString:
    def setup_method(self):
        self.decorator = TimeDeltaString()
        self.dialect = MagicMock()

    def test_bind_param_converts_timedelta_to_iso(self):
        td = timedelta(hours=1)
        result = self.decorator.process_bind_param(td, self.dialect)
        assert result == "PT1H"

    def test_bind_param_one_day(self):
        td = timedelta(days=1)
        result = self.decorator.process_bind_param(td, self.dialect)
        assert result == "P1D"

    def test_bind_param_none_returns_none(self):
        assert self.decorator.process_bind_param(None, self.dialect) is None

    def test_result_value_parses_iso_string(self):
        result = self.decorator.process_result_value("PT1H", self.dialect)
        assert result == timedelta(hours=1)

    def test_result_value_none_returns_none(self):
        assert self.decorator.process_result_value(None, self.dialect) is None

    def test_round_trip(self):
        td = timedelta(minutes=30)
        serialized = self.decorator.process_bind_param(td, self.dialect)
        recovered = self.decorator.process_result_value(serialized, self.dialect)
        assert recovered == td


class TestScenarioBase:
    def _valid(self, **overrides):
        defaults = dict(
            nom="Test",
            date_de_debut="2024-01-01T00:00:00",
            date_de_fin="2024-12-31T23:00:00",
            pas_de_temps="PT1H",
        )
        defaults.update(overrides)
        return ScenarioBase(**defaults)

    def test_date_de_debut_parsed_from_string(self):
        s = self._valid(date_de_debut="2024-06-01T00:00:00")
        assert s.date_de_debut == datetime(2024, 6, 1)

    def test_pas_de_temps_parsed_from_iso(self):
        s = self._valid(pas_de_temps="PT1H")
        assert s.pas_de_temps == timedelta(hours=1)

    def test_pas_de_temps_daily(self):
        s = self._valid(pas_de_temps="P1D")
        assert s.pas_de_temps == timedelta(days=1)

    def test_invalid_date_format_raises(self):
        with pytest.raises(Exception):
            self._valid(date_de_debut="not-a-date")

    def test_invalid_timedelta_format_raises(self):
        with pytest.raises(Exception):
            self._valid(pas_de_temps="1hour")

    def test_default_weather_is_typical(self):
        s = self._valid()
        assert s.weather == Weather.typical

    def test_default_consomation_is_pv(self):
        s = self._valid()
        assert s.consomation == Consomation.PV

    def test_explicit_weather(self):
        s = self._valid(weather=Weather.cold)
        assert s.weather == Weather.cold


class TestEolienneParcBase:
    def _valid(self, **overrides):
        defaults = dict(
            nom="Parc Éolien",
            latitude=46.0,
            longitude=-73.0,
            nombre_eoliennes=10,
            capacite_total=20.0,
            hauteur_moyenne=80.0,
            modele_turbine=TurbineModel.MM92,
            puissance_nominal=2000.0,
        )
        defaults.update(overrides)
        return EolienneParcBase(**defaults)

    def test_turbine_model_enum(self):
        p = self._valid(modele_turbine=TurbineModel.GE_1_5SLE)
        assert p.modele_turbine == TurbineModel.GE_1_5SLE

    def test_missing_nom_raises(self):
        with pytest.raises(Exception):
            EolienneParcBase(
                latitude=46.0, longitude=-73.0,
                nombre_eoliennes=5, capacite_total=10.0,
                hauteur_moyenne=80.0,
                modele_turbine=TurbineModel.MM92,
                puissance_nominal=2000.0,
            )


class TestSolaireBase:
    def _valid(self, **overrides):
        defaults = dict(
            nom="Parc Solaire",
            latitude=45.5,
            longitude=-73.5,
            angle_panneau=45,
            orientation_panneau=180,
            puissance_nominal=10.0,
            nombre_panneau=30000,
        )
        defaults.update(overrides)
        return SolaireBase(**defaults)

    def test_optional_fields_default_none(self):
        s = self._valid()
        assert s.annee_commission is None
        assert s.panneau_type is None

    def test_optional_fields_accepted(self):
        s = self._valid(annee_commission=2020, panneau_type="monocristallin")
        assert s.annee_commission == 2020
        assert s.panneau_type == "monocristallin"


class TestThermiqueBase:
    def _valid(self, **overrides):
        defaults = dict(
            nom="Centrale Thermique",
            latitude=45.5,
            longitude=-73.0,
            type_intrant=TypeIntrantThermique.GAZ_NATUREL,
            puissance_nominal=400.0,
            semaine_maintenance=15,
        )
        defaults.update(overrides)
        return ThermiqueBase(**defaults)

    def test_type_intrant_variants(self):
        for t_type in TypeIntrantThermique:
            t = self._valid(type_intrant=t_type)
            assert t.type_intrant == t_type


class TestNucleaireBase:
    def _valid(self, **overrides):
        defaults = dict(
            nom="Centrale Nucléaire",
            latitude=46.0,
            longitude=-72.0,
            puissance_nominal=1200.0,
            semaine_maintenance=20,
        )
        defaults.update(overrides)
        return NucleaireBase(**defaults)

    def test_optional_fields_default_none(self):
        n = self._valid()
        assert n.annee_commission is None
        assert n.type_generateur is None


class TestBusBase:
    def _valid(self, **overrides):
        defaults = dict(
            name="Bus1",
            v_nom=735,
            type=BusType.prod,
            x=-73.5,
            y=45.5,
            control=BusControlType.PQ,
        )
        defaults.update(overrides)
        return BusBase(**defaults)

    def test_control_enum_variants(self):
        for ctrl in BusControlType:
            b = self._valid(control=ctrl)
            assert b.control == ctrl

    def test_type_enum_variants(self):
        for bt in BusType:
            b = self._valid(type=bt)
            assert b.type == bt

    def test_optional_display_name(self):
        b = self._valid(display_name="Main Bus")
        assert b.display_name == "Main Bus"
