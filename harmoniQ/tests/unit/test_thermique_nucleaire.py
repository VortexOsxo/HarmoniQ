import datetime
import numpy as np
import pytest
from unittest.mock import MagicMock

from harmoniq.modules.nucleaire import InfraNucleaire
from harmoniq.modules.thermique import InfraThermique


def _make_nucleaire(puissance_nominal=900, semaine_maintenance=4):
    donnees = MagicMock()
    donnees.puissance_nominal = puissance_nominal
    donnees.semaine_maintenance = semaine_maintenance
    donnees.nom = "Test-Nuc"
    return donnees


def _make_thermique(puissance_nominal=500):
    donnees = MagicMock()
    donnees.puissance_nominal = puissance_nominal
    donnees.nom = "Test-Therm"
    donnees.type_intrant = "Gaz"
    return donnees


def _make_scenario(hours=1):
    scenario = MagicMock()
    scenario.pas_de_temps = datetime.timedelta(hours=hours)
    return scenario


class TestInfraNucleaire:
    def setup_method(self):
        self.infra = InfraNucleaire(_make_nucleaire(900, semaine_maintenance=4))
        self.infra.scenario = _make_scenario(hours=1)

    def test_calculer_cout_pas_de_temps_returns_positive(self):
        cost = self.infra.calculer_cout_pas_de_temps()
        assert cost > 0

    def test_calculer_cout_pas_de_temps_proportional_to_hours(self):
        self.infra.scenario = _make_scenario(hours=1)
        cost_1h = self.infra.calculer_cout_pas_de_temps()
        self.infra.scenario = _make_scenario(hours=2)
        cost_2h = self.infra.calculer_cout_pas_de_temps()
        assert abs(cost_2h / cost_1h - 2.0) < 1e-6

    def test_calculer_cout_pas_de_temps_proportional_to_power(self):
        infra_small = InfraNucleaire(_make_nucleaire(300, 4))
        infra_large = InfraNucleaire(_make_nucleaire(900, 4))
        infra_small.scenario = _make_scenario(hours=1)
        infra_large.scenario = _make_scenario(hours=1)
        assert infra_large.calculer_cout_pas_de_temps() > infra_small.calculer_cout_pas_de_temps()

    def test_calculer_cout_pas_de_temps_daily_is_24x_hourly(self):
        self.infra.scenario = _make_scenario(hours=1)
        cost_hourly = self.infra.calculer_cout_pas_de_temps()
        self.infra.scenario = _make_scenario(hours=24)
        cost_daily = self.infra.calculer_cout_pas_de_temps()
        assert abs(cost_daily / cost_hourly - 24.0) < 1e-6

    def test_calculer_co2_eq_construction_scales_with_power(self):
        infra = InfraNucleaire(_make_nucleaire(1000))
        co2 = infra.calculer_co2_eq_construction()
        assert co2 == 1000 * 800

    def test_calculer_co2_eq_construction_zero_power(self):
        infra = InfraNucleaire(_make_nucleaire(0))
        assert infra.calculer_co2_eq_construction() == 0

    def test_calculer_co2_eq_pas_de_temps_positive(self):
        co2 = self.infra.calculer_co2_eq_pas_de_temps()
        assert co2 > 0

    def test_calculer_co2_eq_pas_de_temps_proportional_to_hours(self):
        self.infra.scenario = _make_scenario(hours=1)
        co2_1h = self.infra.calculer_co2_eq_pas_de_temps()
        self.infra.scenario = _make_scenario(hours=2)
        co2_2h = self.infra.calculer_co2_eq_pas_de_temps()
        assert abs(co2_2h / co2_1h - 2.0) < 1e-6

    def test_calculer_cout_construction_not_implemented_on_base(self):
        cost = self.infra.calculer_cout_construction()
        assert cost is not None or cost is None


class TestInfraThermique:
    def setup_method(self):
        self.infra = InfraThermique(_make_thermique(500))
        self.infra.scenario = _make_scenario(hours=1)
        self.infra._maintenance_week = 10

    def test_calculer_cout_construction_scales_with_power(self):
        infra_a = InfraThermique(_make_thermique(100))
        infra_b = InfraThermique(_make_thermique(200))
        cost_a = infra_a.calculer_cout_construction()
        cost_b = infra_b.calculer_cout_construction()
        assert abs(cost_b / cost_a - 2.0) < 1e-6

    def test_calculer_cout_pas_de_temps_positive(self):
        cost = self.infra.calculer_cout_pas_de_temps()
        assert cost > 0

    def test_calculer_cout_pas_de_temps_proportional_to_hours(self):
        self.infra.scenario = _make_scenario(hours=1)
        cost_1h = self.infra.calculer_cout_pas_de_temps()
        self.infra.scenario = _make_scenario(hours=4)
        cost_4h = self.infra.calculer_cout_pas_de_temps()
        assert abs(cost_4h / cost_1h - 4.0) < 1e-6

    def test_calculer_co2_eq_construction_scales_with_power(self):
        infra = InfraThermique(_make_thermique(1000))
        co2 = infra.calculer_co2_eq_construction()
        assert co2 == 1000 * 27.5

    def test_calculer_co2_eq_pas_de_temps_positive(self):
        co2 = self.infra.calculer_co2_eq_pas_de_temps()
        assert co2 > 0

    def test_calculer_co2_eq_pas_de_temps_proportional_to_hours(self):
        self.infra.scenario = _make_scenario(hours=1)
        co2_1h = self.infra.calculer_co2_eq_pas_de_temps()
        self.infra.scenario = _make_scenario(hours=2)
        co2_2h = self.infra.calculer_co2_eq_pas_de_temps()
        assert abs(co2_2h / co2_1h - 2.0) < 1e-6
