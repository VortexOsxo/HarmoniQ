"""Tests for pure utility functions in calculs_production_solaire and InfraSolaire."""
import datetime
import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock

from harmoniq.modules.solaire.calculs_production_solaire import (
    cost_solar_powerplant,
    calculate_installation_cost,
    calculate_lifetime,
    compute_facteur_densite,
    PANELS_PAR_SCENARIO,
    SURFACE_PAR_PANNEAU_M2,
)
from harmoniq.modules.solaire import InfraSolaire


class TestCostSolarPowerplant:
    def test_returns_dict(self):
        assert isinstance(cost_solar_powerplant(10), dict)

    def test_scales_linearly(self):
        c1 = list(cost_solar_powerplant(1).values())[0]
        c10 = list(cost_solar_powerplant(10).values())[0]
        assert abs(c10 / c1 - 10.0) < 1e-6

    def test_positive_result(self):
        assert list(cost_solar_powerplant(5).values())[0] > 0


class TestCalculateInstallationCost:
    def test_returns_dict(self):
        assert isinstance(calculate_installation_cost(5), dict)

    def test_small_install_more_expensive_per_mw(self):
        small = list(calculate_installation_cost(0.5).values())[0] / 0.5
        large = list(calculate_installation_cost(10).values())[0] / 10
        assert small > large

    def test_all_tiers_return_positive(self):
        for mw in [0.5, 2.0, 10.0]:
            val = list(calculate_installation_cost(mw).values())[0]
            assert val > 0


class TestCalculateLifetime:
    def test_small_returns_25(self):
        assert list(calculate_lifetime(0.5).values())[0] == 25

    def test_medium_returns_30(self):
        assert list(calculate_lifetime(5).values())[0] == 30

    def test_large_returns_35(self):
        assert list(calculate_lifetime(20).values())[0] == 35

    def test_boundary_1mw_is_medium(self):
        assert list(calculate_lifetime(1.0).values())[0] == 30

    def test_boundary_10mw_is_large(self):
        assert list(calculate_lifetime(10.0).values())[0] == 35


class TestComputeFacteurDensite:
    def test_rural_returns_1(self):
        f = compute_facteur_densite(population=100, superficie_km2=100, m2_par_client=6.8)
        assert f == 1.0

    def test_dense_urban_less_than_1(self):
        f = compute_facteur_densite(population=500_000, superficie_km2=100, m2_par_client=10.2)
        assert f < 1.0

    def test_result_between_0_and_1(self):
        for pop, sup in [(100, 100), (5000, 50), (100_000, 100), (1_000_000, 100)]:
            f = compute_facteur_densite(pop, sup, m2_par_client=6.8)
            assert 0.0 < f <= 1.0

    def test_zero_superficie_handled(self):
        # should not raise (uses max(superficie_km2, 1.0))
        f = compute_facteur_densite(1000, 0, 6.8)
        assert f > 0


class TestPanelsConstants:
    def test_scenarios_defined(self):
        assert "pessimiste" in PANELS_PAR_SCENARIO
        assert "neutre" in PANELS_PAR_SCENARIO
        assert "optimiste" in PANELS_PAR_SCENARIO

    def test_optimiste_more_than_pessimiste(self):
        assert PANELS_PAR_SCENARIO["optimiste"] > PANELS_PAR_SCENARIO["pessimiste"]

    def test_surface_per_panel_positive(self):
        assert SURFACE_PAR_PANNEAU_M2 > 0


class TestInfraSolaireCosts:
    def _make_infra(self, puissance_nominal=5.0):
        donnees = MagicMock()
        donnees.puissance_nominal = puissance_nominal
        infra = InfraSolaire(donnees)
        infra.scenario = MagicMock()
        infra.scenario.pas_de_temps = datetime.timedelta(hours=1)
        return infra

    def test_calculer_cout_construction_scales_with_power(self):
        a = InfraSolaire(MagicMock(puissance_nominal=10)).calculer_cout_construction()
        b = InfraSolaire(MagicMock(puissance_nominal=20)).calculer_cout_construction()
        assert abs(b / a - 2.0) < 1e-6

    def test_calculer_cout_pas_de_temps_positive(self):
        assert self._make_infra().calculer_cout_pas_de_temps() > 0

    def test_calculer_cout_pas_de_temps_proportional_to_hours(self):
        infra = self._make_infra()
        infra.scenario.pas_de_temps = datetime.timedelta(hours=1)
        c1 = infra.calculer_cout_pas_de_temps()
        infra.scenario.pas_de_temps = datetime.timedelta(hours=2)
        c2 = infra.calculer_cout_pas_de_temps()
        assert abs(c2 / c1 - 2.0) < 1e-6

    def test_calculer_co2_eq_construction_scales_with_power(self):
        a = InfraSolaire(MagicMock(puissance_nominal=10)).calculer_co2_eq_construction()
        b = InfraSolaire(MagicMock(puissance_nominal=20)).calculer_co2_eq_construction()
        assert abs(b / a - 2.0) < 1e-6

    def test_calculer_co2_eq_pas_de_temps_is_zero(self):
        # Solar has no combustion — operation emits 0 CO2
        assert self._make_infra().calculer_co2_eq_pas_de_temps() == 0.0
