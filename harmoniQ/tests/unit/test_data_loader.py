"""Tests for NetworkDataLoader (constructor and set_infras) and DataLoadError."""
import pytest
from pathlib import Path
from unittest.mock import MagicMock

from harmoniq.modules.reseau.utils.data_loader import NetworkDataLoader, DataLoadError


DATA_DIR = Path(__file__).parents[2] / "harmoniq" / "modules" / "reseau" / "data"


class TestDataLoadError:
    def test_is_exception(self):
        err = DataLoadError("test")
        assert isinstance(err, Exception)

    def test_message_preserved(self):
        err = DataLoadError("répertoire introuvable")
        assert "répertoire introuvable" in str(err)


class TestNetworkDataLoaderInit:
    def test_default_dir_works(self):
        loader = NetworkDataLoader()
        assert loader.data_dir.exists()

    def test_explicit_valid_dir(self):
        loader = NetworkDataLoader(str(DATA_DIR))
        assert loader.data_dir == DATA_DIR

    def test_invalid_dir_raises(self):
        with pytest.raises(DataLoadError):
            NetworkDataLoader("/nonexistent/path/that/does/not/exist")

    def test_infra_attrs_start_none(self):
        loader = NetworkDataLoader()
        assert loader.eolienne_data is None
        assert loader.solaire_data is None
        assert loader.hydro_data is None
        assert loader.thermique_data is None
        assert loader.nucleaire_data is None


class TestSetInfras:
    @pytest.fixture
    def loader(self):
        return NetworkDataLoader()

    def test_sets_eolienne_data(self, loader):
        infra = MagicMock()
        infra.parc_eoliens = ["parc1", "parc2"]
        loader.set_infras(infra)
        assert loader.eolienne_data == ["parc1", "parc2"]

    def test_sets_solaire_data(self, loader):
        infra = MagicMock()
        infra.parc_solaires = ["sol1"]
        loader.set_infras(infra)
        assert loader.solaire_data == ["sol1"]

    def test_sets_hydro_data(self, loader):
        infra = MagicMock()
        infra.central_hydroelectriques = ["hydro1"]
        loader.set_infras(infra)
        assert loader.hydro_data == ["hydro1"]

    def test_sets_thermique_data(self, loader):
        infra = MagicMock()
        infra.central_thermique = ["therm1"]
        loader.set_infras(infra)
        assert loader.thermique_data == ["therm1"]

    def test_sets_nucleaire_data(self, loader):
        infra = MagicMock()
        infra.central_nucleaire = ["nuc1"]
        loader.set_infras(infra)
        assert loader.nucleaire_data == ["nuc1"]

    def test_none_attr_not_set(self, loader):
        infra = MagicMock()
        infra.parc_eoliens = None
        loader.set_infras(infra)
        assert loader.eolienne_data is None
