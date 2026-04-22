import numpy as np
import pandas as pd
import pytest

from harmoniq.modules.eolienne.weibull.Weibull_calcule import (
    month_to_season,
    drop_feb29_from_index,
    parse_weibull_fit_details,
    extract_annual_coefficients_from_details,
)


class TestMonthToSeason:
    @pytest.mark.parametrize("month,expected", [
        (12, "winter"), (1, "winter"), (2, "winter"),
        (3, "spring"), (4, "spring"), (5, "spring"),
        (6, "summer"), (7, "summer"), (8, "summer"),
        (9, "autumn"), (10, "autumn"), (11, "autumn"),
    ])
    def test_all_months(self, month, expected):
        assert month_to_season(month) == expected

    def test_invalid_month_raises(self):
        with pytest.raises(ValueError):
            month_to_season(13)


class TestDropFeb29:
    def test_removes_feb_29(self):
        idx = pd.date_range("2020-02-28", periods=3, freq="D")
        df = pd.DataFrame({"v": [1, 2, 3]}, index=idx)
        result = drop_feb29_from_index(df)
        assert len(result) == 2
        assert pd.Timestamp("2020-02-29") not in result.index

    def test_no_change_without_feb29(self):
        idx = pd.date_range("2023-01-01", periods=5, freq="D")
        df = pd.DataFrame({"v": range(5)}, index=idx)
        result = drop_feb29_from_index(df)
        assert len(result) == 5

    def test_raises_without_datetime_index(self):
        df = pd.DataFrame({"v": [1, 2]})
        with pytest.raises(TypeError):
            drop_feb29_from_index(df)


class TestParseWeibullFitDetails:
    def test_none_returns_empty(self):
        assert parse_weibull_fit_details(None) == {}

    def test_dict_passthrough(self):
        d = {"annual": {"k": 2.0, "c": 8.0}}
        assert parse_weibull_fit_details(d) == d

    def test_valid_json_string(self):
        s = '{"annual": {"k": 2.0, "c": 8.0}}'
        result = parse_weibull_fit_details(s)
        assert result == {"annual": {"k": 2.0, "c": 8.0}}

    def test_invalid_json_returns_empty(self):
        assert parse_weibull_fit_details("not json") == {}

    def test_empty_string_returns_empty(self):
        assert parse_weibull_fit_details("") == {}

    def test_other_type_returns_empty(self):
        assert parse_weibull_fit_details(42) == {}


class TestExtractAnnualCoefficients:
    def test_valid_annual_entry(self):
        details = {"annual": {"k": 2.0, "c": 8.5}}
        result = extract_annual_coefficients_from_details(details)
        assert result == (2.0, 8.5)

    def test_missing_annual_returns_none(self):
        assert extract_annual_coefficients_from_details({}) is None

    def test_invalid_kc_values_returns_none(self):
        details = {"annual": {"k": -1.0, "c": 8.0}}
        assert extract_annual_coefficients_from_details(details) is None

    def test_non_dict_returns_none(self):
        assert extract_annual_coefficients_from_details("bad") is None

    def test_zero_k_returns_none(self):
        details = {"annual": {"k": 0, "c": 8.0}}
        assert extract_annual_coefficients_from_details(details) is None
