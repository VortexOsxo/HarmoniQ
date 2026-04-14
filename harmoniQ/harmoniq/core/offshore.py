from __future__ import annotations

import math

from pyproj import Transformer
from sqlalchemy import text
from sqlalchemy.orm import Session


DEFAULT_QC_OFFSHORE_GRID_VERSION = "qc_mer_1km_v1"


def is_offshore_quebec(
    latitude: float,
    longitude: float,
    db: Session,
    grid_version: str = DEFAULT_QC_OFFSHORE_GRID_VERSION,
) -> bool:
    """Return True if the given point falls in an offshore mesh cell for Quebec."""
    meta = db.execute(
        text(
            """
            SELECT resolution_m, crs, origin_x, origin_y
            FROM quebec_offshore_mesh_meta
            WHERE grid_version = :grid_version
            LIMIT 1
            """
        ),
        {"grid_version": grid_version},
    ).mappings().first()
    if meta is None:
        raise ValueError(
            f"Offshore mesh metadata not found for grid_version='{grid_version}'. "
            "Generate and load the mesh first."
        )
    resolution_m = int(meta["resolution_m"])
    if resolution_m <= 0:
        raise ValueError(
            f"Invalid resolution_m={resolution_m} for grid_version='{grid_version}'"
        )

    transformer = Transformer.from_crs("EPSG:4326", str(meta["crs"]), always_xy=True)
    x, y = transformer.transform(float(longitude), float(latitude))
    ix = int(math.floor((float(x) - float(meta["origin_x"])) / float(resolution_m)))
    iy = int(math.floor((float(y) - float(meta["origin_y"])) / float(resolution_m)))

    point_row = db.execute(
        text(
            """
            SELECT 1
            FROM quebec_offshore_mesh_points
            WHERE grid_version = :grid_version
              AND ix = :ix
              AND iy = :iy
            LIMIT 1
            """
        ),
        {"grid_version": grid_version, "ix": ix, "iy": iy},
    )
    return point_row.first() is not None
