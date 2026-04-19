"""Tests for InfraReseau.__init__ and _normaliser_types_reseau."""
import pytest
import pypsa
import pandas as pd
from unittest.mock import MagicMock

from harmoniq.modules.reseau import InfraReseau


def _make_donnees():
    d = MagicMock()
    d.nom = "TestReseau"
    return d


class TestInfraReseauInit:
    def test_instantiates(self):
        infra = InfraReseau(_make_donnees())
        assert infra is not None

    def test_network_starts_none(self):
        infra = InfraReseau(_make_donnees())
        assert infra.network is None

    def test_reservoir_levels_empty(self):
        infra = InfraReseau(_make_donnees())
        assert infra.reservoir_levels == {}

    def test_statistics_empty(self):
        infra = InfraReseau(_make_donnees())
        assert infra.statistics == {}

    def test_is_journalier_false_by_default(self):
        infra = InfraReseau(_make_donnees())
        assert infra.is_journalier is False

    def test_scenario_not_loaded(self):
        infra = InfraReseau(_make_donnees())
        assert infra.scenario_charger is False

    def test_builder_created(self):
        infra = InfraReseau(_make_donnees())
        assert infra.builder is not None


class TestNormaliserTypesReseau:
    def _make_network(self):
        idx = pd.date_range("2024-01-01", periods=2, freq="h")
        n = pypsa.Network()
        n.set_snapshots(idx)
        n.add("Bus", "b1")
        n.add("Generator", "g1", bus="b1", p_nom=100.0, carrier="eolien", marginal_cost=0.1)
        n.add("Load", "l1", bus="b1")
        return n

    def test_runs_without_error(self):
        infra = InfraReseau(_make_donnees())
        n = self._make_network()
        infra._normaliser_types_reseau(n)  # should not raise

    def test_bus_type_converted_to_str(self):
        infra = InfraReseau(_make_donnees())
        n = self._make_network()
        n.buses["type"] = 1  # integer type
        infra._normaliser_types_reseau(n)
        assert n.buses["type"].dtype == object  # str columns have object dtype


class TestNecessiteScenario:
    def test_creer_reseau_raises_without_scenario(self):
        import asyncio
        infra = InfraReseau(_make_donnees())
        with pytest.raises(ValueError, match="Scenario pas chargé"):
            asyncio.run(infra.creer_reseau())
