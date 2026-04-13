import pandas as pd
import pytest
from unittest.mock import MagicMock

from harmoniq.modules.reseau.utils.geo_utils import GeoUtils


@pytest.fixture
def geo():
    return GeoUtils()


MONTREAL = (45.5017, -73.5673)
QUEBEC   = (46.8139, -71.2080)
EXPECTED_MTL_QC_KM = 233.0


class TestCalculateDistance:
    def test_same_point_is_zero(self, geo):
        assert geo.calculate_distance(MONTREAL, MONTREAL) == pytest.approx(0.0)

    def test_known_montreal_quebec(self, geo):
        d = geo.calculate_distance(MONTREAL, QUEBEC)
        assert d == pytest.approx(EXPECTED_MTL_QC_KM, rel=0.05)

    def test_symmetry(self, geo):
        d1 = geo.calculate_distance(MONTREAL, QUEBEC)
        d2 = geo.calculate_distance(QUEBEC, MONTREAL)
        assert d1 == pytest.approx(d2)

    def test_returns_positive_float(self, geo):
        d = geo.calculate_distance((0.0, 0.0), (1.0, 1.0))
        assert d > 0

    def test_antipodal_points_near_max_earth_circumference(self, geo):
        north_pole = (90.0, 0.0)
        south_pole = (-90.0, 0.0)
        d = geo.calculate_distance(north_pole, south_pole)
        assert d == pytest.approx(20015.0, rel=0.01)

    def test_equator_one_degree_longitude(self, geo):
        p1 = (0.0, 0.0)
        p2 = (0.0, 1.0)
        d = geo.calculate_distance(p1, p2)
        assert d == pytest.approx(111.32, rel=0.01)


class TestCalculateLineLength:
    def test_single_segment(self, geo):
        points = [MONTREAL, QUEBEC]
        length = geo.calculate_line_length(points)
        direct = geo.calculate_distance(MONTREAL, QUEBEC)
        assert length == pytest.approx(direct)

    def test_two_segments_sum(self, geo):
        paris = (48.8566, 2.3522)
        london = (51.5074, -0.1278)
        berlin = (52.5200, 13.4050)
        expected = geo.calculate_distance(paris, london) + geo.calculate_distance(london, berlin)
        result = geo.calculate_line_length([paris, london, berlin])
        assert result == pytest.approx(expected)

    def test_triangle_inequality(self, geo):
        a = (45.0, -74.0)
        b = (46.0, -72.0)
        c = (47.0, -70.0)
        direct = geo.calculate_distance(a, c)
        via_b = geo.calculate_line_length([a, b, c])
        assert via_b >= direct

    def test_single_point_returns_zero(self, geo):
        assert geo.calculate_line_length([MONTREAL]) == pytest.approx(0.0)


class TestFindNearestBus:
    def _make_buses_df(self, entries):
        return pd.DataFrame(
            [{"name": n, "y": lat, "x": lon} for n, lat, lon in entries]
        )

    def test_finds_closest_bus(self, geo):
        buses = self._make_buses_df([
            ("BusQC", 46.8139, -71.2080),
            ("BusMTL", 45.5017, -73.5673),
        ])
        nearest, dist = geo.find_nearest_bus(MONTREAL, buses)
        assert nearest == "BusMTL"
        assert dist < 1.0

    def test_returns_distance_in_km(self, geo):
        buses = self._make_buses_df([("BusQC", 46.8139, -71.2080)])
        _, dist = geo.find_nearest_bus(MONTREAL, buses)
        expected = geo.calculate_distance(MONTREAL, QUEBEC)
        assert dist == pytest.approx(expected, rel=0.01)

    def test_single_bus_always_nearest(self, geo):
        buses = self._make_buses_df([("OnlyBus", 50.0, -70.0)])
        nearest, _ = geo.find_nearest_bus((45.0, -73.0), buses)
        assert nearest == "OnlyBus"

    def test_pypsa_network_input(self, geo):
        buses_df = pd.DataFrame(
            {"x": [-73.5673, -71.2080], "y": [45.5017, 46.8139]},
            index=["BusMTL", "BusQC"],
        )
        mock_network = MagicMock()
        mock_network.buses = buses_df
        nearest, _ = geo.find_nearest_bus(MONTREAL, mock_network)
        assert nearest == "BusMTL"
