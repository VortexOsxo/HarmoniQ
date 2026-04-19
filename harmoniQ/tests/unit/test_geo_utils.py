import pandas as pd
import pytest
from harmoniq.modules.reseau.utils.geo_utils import GeoUtils, Point


class TestGeoUtils:
    def setup_method(self):
        self.geo = GeoUtils()

    def test_same_point_is_zero(self):
        assert self.geo.calculate_distance((45.5, -73.5), (45.5, -73.5)) == 0.0

    def test_montreal_to_quebec_approx(self):
        mtl = (45.5017, -73.5673)
        qc = (46.8139, -71.2080)
        dist = self.geo.calculate_distance(mtl, qc)
        assert 230 < dist < 280

    def test_distance_is_symmetric(self):
        a = (45.5, -73.5)
        b = (46.8, -71.2)
        assert abs(self.geo.calculate_distance(a, b) - self.geo.calculate_distance(b, a)) < 1e-9

    def test_distance_is_positive(self):
        assert self.geo.calculate_distance((45.0, -73.0), (46.0, -72.0)) > 0

    def test_calculate_line_length_two_points(self):
        a, b = (45.5, -73.5), (46.8, -71.2)
        line_len = self.geo.calculate_line_length([a, b])
        direct = self.geo.calculate_distance(a, b)
        assert abs(line_len - direct) < 1e-9

    def test_calculate_line_length_three_points(self):
        a, b, c = (45.5, -73.5), (46.0, -72.0), (46.8, -71.2)
        total = self.geo.calculate_line_length([a, b, c])
        ab = self.geo.calculate_distance(a, b)
        bc = self.geo.calculate_distance(b, c)
        assert abs(total - (ab + bc)) < 1e-9

    def test_find_nearest_bus_returns_correct(self):
        buses = pd.DataFrame({
            "name": ["BusA", "BusB"],
            "x": [-73.5, -70.0],
            "y": [45.5, 50.0],
        })
        nearest, dist = self.geo.find_nearest_bus((45.6, -73.4), buses)
        assert nearest == "BusA"
        assert dist < 20


class TestPoint:
    def test_point_attributes(self):
        p = Point(lat=45.5, lon=-73.5, name="Montréal")
        assert p.lat == 45.5
        assert p.lon == -73.5
        assert p.name == "Montréal"

    def test_point_default_name(self):
        p = Point(45.0, -73.0)
        assert p.name is None
