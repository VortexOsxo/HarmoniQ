import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch, call
from pydantic import BaseModel
from typing import Optional

from harmoniq.db.CRUD import (
    hydrate_model,
    create_data,
    read_all_data,
    read_data_by_id,
    read_multiple_by_id,
    update_data,
    delete_data,
)


class FakePydantic(BaseModel):
    id: Optional[int] = None
    nom: str = "test"
    puissance_nominal: float = 100.0


class FakePydanticWithAlias(BaseModel):
    puissance_nominale: float = 200.0


def _make_mock_table(columns: list[str]):
    col_mocks = []
    for c in columns:
        col = MagicMock()
        col.name = c
        col_mocks.append(col)

    mock_table = MagicMock()
    mock_table.__table__ = MagicMock()
    mock_table.__table__.columns = col_mocks
    mock_table.__name__ = "FakeTable"
    return mock_table


def _make_mock_session():
    session = MagicMock()
    session.query.return_value.all.return_value = []
    session.query.return_value.filter.return_value.first.return_value = None
    session.query.return_value.filter.return_value.all.return_value = []
    return session


class TestHydrateModel:
    def test_none_input_returns_none(self):
        table = _make_mock_table(["nom"])
        assert hydrate_model(table, None) is None

    def test_pydantic_model_dump(self):
        table = _make_mock_table(["nom", "puissance_nominal"])
        pydantic_obj = FakePydantic(nom="Centrale-A", puissance_nominal=300.0)
        result = hydrate_model(table, pydantic_obj)
        table.assert_called_once_with(nom="Centrale-A", puissance_nominal=300.0)

    def test_dict_input(self):
        table = _make_mock_table(["nom"])
        result = hydrate_model(table, {"nom": "from_dict"})
        table.assert_called_once_with(nom="from_dict")

    def test_alias_puissance_nominale_mapped(self):
        table = _make_mock_table(["puissance_nominal"])
        obj = FakePydanticWithAlias(puissance_nominale=250.0)
        hydrate_model(table, obj)
        call_kwargs = table.call_args[1]
        assert "puissance_nominal" in call_kwargs
        assert call_kwargs["puissance_nominal"] == 250.0

    def test_extra_fields_in_dict_are_ignored(self):
        table = _make_mock_table(["nom"])
        hydrate_model(table, {"nom": "X", "unknown_field": 99})
        table.assert_called_once_with(nom="X")

    def test_unknown_dict_without_matching_columns(self):
        table = _make_mock_table(["nom"])
        result = hydrate_model(table, {"latitude": 45.0})
        table.assert_called_once_with()


def _run(coro):
    return asyncio.run(coro)


class TestReadAllData:
    def test_queries_the_table(self):
        session = _make_mock_session()
        table = _make_mock_table(["id"])
        session.query.return_value.all.return_value = ["row1", "row2"]
        result = _run(read_all_data(session, table))
        session.query.assert_called_once_with(table)
        assert result == ["row1", "row2"]

    def test_returns_empty_list_when_no_rows(self):
        session = _make_mock_session()
        table = _make_mock_table(["id"])
        result = _run(read_all_data(session, table))
        assert result == []


class TestCreateData:
    def test_adds_and_commits(self):
        session = _make_mock_session()
        table = MagicMock()
        fake_instance = MagicMock()
        table.return_value = fake_instance

        data = FakePydantic(nom="new")
        result = _run(create_data(session, table, data))

        session.add.assert_called_once_with(fake_instance)
        session.commit.assert_called_once()
        session.refresh.assert_called_once_with(fake_instance)
        assert result is fake_instance


class TestReadDataById:
    def test_filters_by_id(self):
        session = _make_mock_session()
        table = _make_mock_table(["id"])
        fake_row = MagicMock()
        session.query.return_value.filter.return_value.first.return_value = fake_row
        result = _run(read_data_by_id(session, table, 5))
        assert result is fake_row

    def test_returns_none_when_not_found(self):
        session = _make_mock_session()
        table = _make_mock_table(["id"])
        result = _run(read_data_by_id(session, table, 999))
        assert result is None


class TestReadMultipleById:
    def test_filters_by_id_list(self):
        session = _make_mock_session()
        table = _make_mock_table(["id"])
        expected = [MagicMock(), MagicMock()]
        session.query.return_value.filter.return_value.all.return_value = expected
        result = _run(read_multiple_by_id(session, table, [1, 2]))
        assert result is expected

    def test_empty_id_list(self):
        session = _make_mock_session()
        table = _make_mock_table(["id"])
        result = _run(read_multiple_by_id(session, table, []))
        assert result == []


class TestUpdateData:
    def test_returns_none_when_not_found(self):
        session = _make_mock_session()
        table = _make_mock_table(["id", "nom"])
        result = _run(update_data(session, table, 99, FakePydantic(nom="x")))
        assert result is None

    def test_updates_fields_and_commits(self):
        session = _make_mock_session()
        table = _make_mock_table(["id", "nom"])
        db_instance = MagicMock()
        db_instance.nom = "old"
        session.query.return_value.filter.return_value.first.return_value = db_instance

        update_payload = FakePydantic(nom="new_name")
        result = _run(update_data(session, table, 1, update_payload))

        assert db_instance.nom == "new_name"
        session.commit.assert_called_once()
        session.refresh.assert_called_once_with(db_instance)
        assert result is db_instance


class TestDeleteData:
    def test_returns_none_when_not_found(self):
        session = _make_mock_session()
        table = _make_mock_table(["id"])
        result = _run(delete_data(session, table, 999))
        assert result is None

    def test_deletes_and_commits(self):
        session = _make_mock_session()
        table = _make_mock_table(["id"])
        table.__name__ = "TestTable"
        db_instance = MagicMock()
        session.query.return_value.filter.return_value.first.return_value = db_instance

        result = _run(delete_data(session, table, 1))

        session.delete.assert_called_once_with(db_instance)
        session.commit.assert_called_once()
        assert "deleted successfully" in result["message"]
