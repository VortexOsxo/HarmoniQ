import numpy as np
import pandas as pd
import pytest
from unittest.mock import MagicMock

from harmoniq.modules.hydro.calcule import (
    get_facteur_de_charge,
    get_energy,
    estimation_cout_barrage,
    estimer_qualite_ecosysteme_futur,
    estimer_daly_futur,
    calculer_emissions_et_ressources,
)


def _make_barrage(type_barrage: str, puissance_nominal: float, nom: str = "TestBarrage"):
    barrage = MagicMock()
    barrage.donnees.type_barrage = type_barrage
    barrage.donnees.puissance_nominal = puissance_nominal
    barrage.donnees.nom = nom
    return barrage


def _make_production(values, freq="h"):
    idx = pd.date_range("2024-01-01", periods=len(values), freq=freq)
    return pd.Series(values, index=idx, name="power_MW")


class TestGetFacteurDeCharge:
    def test_full_capacity_factor_is_one(self):
        barrage = _make_barrage("Fil de l'eau", puissance_nominal=100.0)
        production = _make_production([100.0] * 8760)
        result = get_facteur_de_charge(barrage, production)
        assert result == pytest.approx(1.0)

    def test_half_production_factor_is_half(self):
        barrage = _make_barrage("Fil de l'eau", puissance_nominal=100.0)
        production = _make_production([50.0] * 8760)
        result = get_facteur_de_charge(barrage, production)
        assert result == pytest.approx(0.5)

    def test_zero_production_factor_is_zero(self):
        barrage = _make_barrage("Reservoir", puissance_nominal=200.0)
        production = _make_production([0.0] * 100)
        result = get_facteur_de_charge(barrage, production)
        assert result == pytest.approx(0.0)

    def test_factor_formula(self):
        barrage = _make_barrage("Fil de l'eau", puissance_nominal=50.0)
        values = [30.0, 40.0, 50.0, 20.0]
        production = _make_production(values)
        expected = sum(values) / (50.0 * len(values))
        assert get_facteur_de_charge(barrage, production) == pytest.approx(expected)


class TestGetEnergy:
    def test_sums_all_values(self):
        production = _make_production([10.0, 20.0, 30.0])
        assert get_energy(production) == pytest.approx(60.0)

    def test_zero_series(self):
        production = _make_production([0.0, 0.0, 0.0])
        assert get_energy(production) == pytest.approx(0.0)

    def test_single_value(self):
        production = _make_production([42.0])
        assert get_energy(production) == pytest.approx(42.0)


class TestEstimationCoutBarrage:
    def test_positive_cost(self):
        barrage = _make_barrage("Reservoir", puissance_nominal=500.0)
        assert estimation_cout_barrage(barrage) > 0

    def test_larger_plant_costs_more(self):
        b_small = _make_barrage("Reservoir", puissance_nominal=100.0)
        b_large = _make_barrage("Reservoir", puissance_nominal=1000.0)
        assert estimation_cout_barrage(b_large) > estimation_cout_barrage(b_small)

    def test_formula_cost_per_mw(self):
        barrage = _make_barrage("Reservoir", puissance_nominal=300.0)
        expected = 300.0 * 14_000_000
        assert estimation_cout_barrage(barrage) == pytest.approx(expected)


class TestEstimerQualiteEcosystemeFutur:
    def test_returns_float(self):
        result = estimer_qualite_ecosysteme_futur(0.5)
        assert isinstance(float(result), float)

    def test_higher_load_factor_higher_impact(self):
        low = estimer_qualite_ecosysteme_futur(0.0)
        high = estimer_qualite_ecosysteme_futur(1.0)
        assert high > low

    def test_zero_load_factor_gives_existing_production_impact(self):
        result = estimer_qualite_ecosysteme_futur(0.0)
        assert result > 0

    def test_load_factor_one_bounded_by_max(self):
        result = estimer_qualite_ecosysteme_futur(1.0)
        assert np.isfinite(result)
        assert result > 0


class TestEstimerDalyFutur:
    def test_returns_positive_float(self):
        result = estimer_daly_futur(0.5)
        assert float(result) > 0

    def test_higher_load_factor_higher_daly(self):
        low = estimer_daly_futur(0.0)
        high = estimer_daly_futur(1.0)
        assert high > low

    def test_finite_for_all_valid_inputs(self):
        for fc in [0.0, 0.25, 0.5, 0.75, 1.0]:
            assert np.isfinite(estimer_daly_futur(fc))


class TestCalculerEmissionsEtRessources:
    def test_returns_dataframe(self):
        barrage = _make_barrage("Reservoir", puissance_nominal=300.0)
        result = calculer_emissions_et_ressources(barrage, energie=1e6, facteur_charge=0.5)
        assert isinstance(result, pd.DataFrame)

    def test_contains_emission_column(self):
        barrage = _make_barrage("Fil de l'eau", puissance_nominal=100.0)
        result = calculer_emissions_et_ressources(barrage, energie=1e5, facteur_charge=0.4)
        assert "Émissions (tonnes CO2/an)" in result.columns

    def test_reservoir_higher_emission_than_run_of_river(self):
        b_ror = _make_barrage("Fil de l'eau", puissance_nominal=100.0)
        b_res = _make_barrage("Reservoir", puissance_nominal=100.0)
        energie, fc = 1e6, 0.5

        res_ror = calculer_emissions_et_ressources(b_ror, energie=energie, facteur_charge=fc)
        res_res = calculer_emissions_et_ressources(b_res, energie=energie, facteur_charge=fc)

        em_ror = res_ror["Émissions (tonnes CO2/an)"].iloc[0]
        em_res = res_res["Émissions (tonnes CO2/an)"].iloc[0]
        assert em_res > em_ror

    def test_zero_energy_zero_emissions(self):
        barrage = _make_barrage("Reservoir", puissance_nominal=300.0)
        result = calculer_emissions_et_ressources(barrage, energie=0.0, facteur_charge=0.5)
        assert result["Émissions (tonnes CO2/an)"].iloc[0] == pytest.approx(0.0)

    def test_barrage_name_in_result(self):
        barrage = _make_barrage("Reservoir", puissance_nominal=300.0, nom="Manic-5")
        result = calculer_emissions_et_ressources(barrage, energie=1e6, facteur_charge=0.5)
        assert result["Barrage"].iloc[0] == "Manic-5"

    def test_load_factor_scales_emissions(self):
        barrage = _make_barrage("Fil de l'eau", puissance_nominal=100.0)
        r1 = calculer_emissions_et_ressources(barrage, energie=1e6, facteur_charge=0.5)
        r2 = calculer_emissions_et_ressources(barrage, energie=1e6, facteur_charge=1.0)
        em1 = r1["Émissions (tonnes CO2/an)"].iloc[0]
        em2 = r2["Émissions (tonnes CO2/an)"].iloc[0]
        assert em2 == pytest.approx(em1 * 2, rel=1e-5)
