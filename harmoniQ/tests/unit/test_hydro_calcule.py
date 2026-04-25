"""Tests for pure/math functions in hydro/calcule.py.

Functions requiring get_db() + real hydro DB rows are skipped here.
The MagicMock below only simulates a data-row object (barrage.donnees.*),
not any library — the business logic is real.
"""
import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock

from harmoniq.modules.hydro.calcule import (
    estimation_cout_barrage,
    estimer_qualite_ecosysteme_futur,
    estimer_daly_futur,
    calculer_emissions_et_ressources,
    get_facteur_de_charge,
    get_energy,
    catch_coeff_map,
)


def _barrage(type_barrage="Fil de l'eau", puissance_nominal=100.0, nom="TestDam"):
    b = MagicMock()
    b.donnees.type_barrage = type_barrage
    b.donnees.puissance_nominal = puissance_nominal
    b.donnees.nom = nom
    return b


# ── estimation_cout_barrage ────────────────────────────────────────────────────

class TestEstimationCoutBarrage:
    def test_positive_fil_eau(self):
        assert estimation_cout_barrage(_barrage("Fil de l'eau", 100)) > 0

    def test_positive_reservoir(self):
        assert estimation_cout_barrage(_barrage("Reservoir", 100)) > 0

    def test_reservoir_more_expensive_than_fil(self):
        fil = estimation_cout_barrage(_barrage("Fil de l'eau", 100))
        res = estimation_cout_barrage(_barrage("Reservoir", 100))
        assert res > fil

    def test_scales_linearly_with_power(self):
        c1 = estimation_cout_barrage(_barrage("Fil de l'eau", 100))
        c2 = estimation_cout_barrage(_barrage("Fil de l'eau", 200))
        assert abs(c2 / c1 - 2.0) < 1e-6


# ── estimer_qualite_ecosysteme_futur ──────────────────────────────────────────

class TestEstimerQualiteEcosysteme:
    def test_returns_positive(self):
        assert estimer_qualite_ecosysteme_futur(0.5) > 0

    def test_higher_facteur_higher_impact(self):
        low = estimer_qualite_ecosysteme_futur(0.1)
        high = estimer_qualite_ecosysteme_futur(0.9)
        assert high > low

    def test_zero_facteur_nonnegative(self):
        assert estimer_qualite_ecosysteme_futur(0.0) >= 0

    def test_returns_scalar(self):
        result = estimer_qualite_ecosysteme_futur(0.5)
        assert np.isscalar(result) or hasattr(result, "__float__")


# ── estimer_daly_futur ────────────────────────────────────────────────────────

class TestEstimerDalyFutur:
    def test_returns_positive(self):
        assert estimer_daly_futur(0.5) > 0

    def test_higher_facteur_higher_daly(self):
        low = estimer_daly_futur(0.1)
        high = estimer_daly_futur(0.9)
        assert high > low

    def test_zero_facteur_nonnegative(self):
        assert estimer_daly_futur(0.0) >= 0


# ── calculer_emissions_et_ressources ─────────────────────────────────────────

class TestCalculerEmissions:
    def test_returns_dataframe(self):
        df = calculer_emissions_et_ressources(_barrage("Fil de l'eau"), 1000.0, 0.5)
        assert isinstance(df, pd.DataFrame)

    def test_has_emission_column(self):
        df = calculer_emissions_et_ressources(_barrage("Reservoir"), 1000.0, 0.5)
        assert "Émissions (tonnes CO2/an)" in df.columns

    def test_reservoir_more_emissions_than_fil(self):
        fil = calculer_emissions_et_ressources(_barrage("Fil de l'eau"), 1000.0, 0.5)
        res = calculer_emissions_et_ressources(_barrage("Reservoir"), 1000.0, 0.5)
        assert res["Émissions (tonnes CO2/an)"].iloc[0] > fil["Émissions (tonnes CO2/an)"].iloc[0]

    def test_zero_facteur_zero_emissions(self):
        df = calculer_emissions_et_ressources(_barrage("Reservoir"), 1000.0, 0.0)
        assert df["Émissions (tonnes CO2/an)"].iloc[0] == 0.0

    def test_has_barrage_column(self):
        df = calculer_emissions_et_ressources(_barrage(nom="MonBarrage"), 500.0, 0.3)
        assert "Barrage" in df.columns
        assert df["Barrage"].iloc[0] == "MonBarrage"

    def test_all_resource_columns_present(self):
        df = calculer_emissions_et_ressources(_barrage("Reservoir"), 1000.0, 0.5)
        for col in [
            "Utilisation ressources minérales (tonnes/an)",
            "Extraction ressources minérales (kg Sb/an)",
            "Utilisation des énergies minérales (kg Sb/an)",
            "Utilisation des énergies non renouvelables (GJ/an)",
        ]:
            assert col in df.columns


# ── get_facteur_de_charge ────────────────────────────────────────────────────

class TestGetFacteurDeCharge:
    def test_full_load(self):
        b = _barrage(puissance_nominal=100.0)
        prod = pd.Series([100.0] * 10)
        fc = get_facteur_de_charge(b, prod)
        assert abs(fc - 1.0) < 1e-9

    def test_half_load(self):
        b = _barrage(puissance_nominal=100.0)
        prod = pd.Series([50.0] * 10)
        fc = get_facteur_de_charge(b, prod)
        assert abs(fc - 0.5) < 1e-9

    def test_positive(self):
        b = _barrage(puissance_nominal=200.0)
        prod = pd.Series([80.0, 100.0, 120.0])
        assert get_facteur_de_charge(b, prod) > 0


# ── get_energy ───────────────────────────────────────────────────────────────

class TestGetEnergy:
    def test_sum_of_series(self):
        assert get_energy(pd.Series([10.0, 20.0, 30.0])) == 60.0

    def test_zero_production(self):
        assert get_energy(pd.Series([0.0, 0.0])) == 0.0

    def test_single_value(self):
        assert get_energy(pd.Series([42.0])) == 42.0


# ── catch_coeff_map ───────────────────────────────────────────────────────────

class TestCatchCoeffMap:
    def test_is_dict(self):
        assert isinstance(catch_coeff_map, dict)

    def test_not_empty(self):
        assert len(catch_coeff_map) > 0

    def test_values_are_numeric(self):
        for v in catch_coeff_map.values():
            assert isinstance(v, (int, float))
