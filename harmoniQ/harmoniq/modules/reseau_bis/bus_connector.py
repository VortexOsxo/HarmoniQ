"""Connecte les nouvelles infrastructures (is_user_created=True) au réseau existant.

Pour chaque nouvelle infra, crée un bus à sa position géographique et le connecte
au bus existant le plus proche (distance Haversine). L'algorithme est itératif :
chaque nouveau bus devient immédiatement un candidat pour les infras suivantes.

Usage (dans service.py) :
    topology = BusConnector(topology).connect_new_infras(liste_infra)
"""

import logging
from math import atan2, cos, radians, sin, sqrt
from typing import Any, List, Optional, Tuple

import pandas as pd

logger = logging.getLogger("BusConnector")

# Capacité par défaut (MVA) — sera ajustée par auto_scale_line_capacities dans network_builder.
_DEFAULT_S_NOM = 2000.0

# Mapping tension (kV) → type de ligne PyPSA.
# On hérite la tension du bus voisin le plus proche pour que le raccordement
# soit cohérent avec le niveau de tension local du réseau.
_VNOM_TO_LINE_TYPE: dict = {
    120: "120kV_line",
    230: "230kV_line",
    315: "315kV_line",
    320: "315kV_line",   # alias — même type de ligne
    345: "345kV_line",
    450: "450kV_line",
    735: "735kV_line",
    765: "735kV_line",   # alias — même type de ligne
}
_DEFAULT_LINE_TYPE = "735kV_line"
_DEFAULT_V_NOM = 735


def _line_type_for_vnom(v_nom: float) -> str:
    """Retourne le type de ligne correspondant à une tension nominale."""
    key = min(_VNOM_TO_LINE_TYPE.keys(), key=lambda k: abs(k - v_nom))
    return _VNOM_TO_LINE_TYPE[key]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcule la distance Haversine entre deux points (en km)."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, (lat1, lon1, lat2, lon2))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def _collect_user_created_infras(liste_infra: Any) -> List[Any]:
    """Retourne toutes les infras marquées is_user_created=True dans le groupe."""
    result = []
    for infra_list in (
        getattr(liste_infra, "parc_eoliens", None) or [],
        getattr(liste_infra, "parc_solaires", None) or [],
        getattr(liste_infra, "central_hydroelectriques", None) or [],
        getattr(liste_infra, "central_thermique", None) or [],
        getattr(liste_infra, "central_nucleaire", None) or [],
    ):
        for infra in infra_list:
            if getattr(infra, "is_user_created", False):
                result.append(infra)
    return result


def _find_nearest_bus(
    lat: float,
    lon: float,
    buses_df: pd.DataFrame,
) -> Tuple[Optional[str], float, float]:
    """Trouve le bus le plus proche dans buses_df.

    Convention interne data_loader : x = latitude, y = longitude.

    Returns:
        (nom_du_bus, distance_km, v_nom) ou (None, inf, 735) si buses_df est vide.
    """
    if buses_df.empty:
        return None, float("inf"), _DEFAULT_V_NOM

    min_dist = float("inf")
    nearest: Optional[str] = None
    nearest_vnom: float = _DEFAULT_V_NOM

    for _, row in buses_df.iterrows():
        bus_lat = float(row["x"])  # convention interne : x = latitude
        bus_lon = float(row["y"])  # convention interne : y = longitude
        dist = _haversine_km(lat, lon, bus_lat, bus_lon)
        if dist < min_dist:
            min_dist = dist
            nearest = str(row["name"])
            nearest_vnom = float(row.get("v_nom", _DEFAULT_V_NOM))

    return nearest, min_dist, nearest_vnom


class BusConnector:
    """Injecte des bus pour les nouvelles infrastructures dans la topologie existante.

    Algorithme itératif :
    1. Collecter toutes les infras marquées is_user_created=True.
    2. Pour chaque infra :
       a. Créer un bus à sa position (lat, lon).
       b. Connecter ce bus au bus existant le plus proche, en incluant
          les bus déjà ajoutés lors des étapes précédentes.
    3. Retourner la topologie augmentée.

    La topologie enrichie est ensuite passée à load_generation_profiles() via
    buses_df, ce qui permet à _resolve_generator_bus() de trouver naturellement
    le nouveau bus (distance = 0) pour chaque générateur user-created.
    """

    def __init__(self, topology: dict) -> None:
        """
        Args:
            topology: dict {"buses": DataFrame, "lines": DataFrame, "line_types": DataFrame}
                      tel que retourné par load_topology_from_db().
        """
        self._topology = topology
        # Copies de travail — on ne modifie pas l'original in-place.
        self._buses_df: pd.DataFrame = topology["buses"].copy()
        self._lines_df: pd.DataFrame = topology["lines"].copy()

    def connect_new_infras(self, liste_infra: Any) -> dict:
        """Point d'entrée public.

        Args:
            liste_infra: SimulationInfraGroup avec parc_eoliens, parc_solaires, etc.

        Returns:
            Topologie dict enrichie des nouveaux bus et lignes.
            Si aucune infra user-created, retourne la topologie originale sans copie.
        """
        new_infras = _collect_user_created_infras(liste_infra)
        if not new_infras:
            return self._topology

        logger.info(
            "BusConnector : %d nouvelle(s) infrastructure(s) à connecter au réseau.",
            len(new_infras),
        )

        for infra in new_infras:
            self._process_infra(infra)

        return {
            **self._topology,
            "buses": self._buses_df.reset_index(drop=True),
            "lines": self._lines_df.reset_index(drop=True),
        }

    def _process_infra(self, infra: Any) -> None:
        """Crée un bus et une ligne de raccordement pour une infra user-created.

        Le nouveau bus est ajouté à self._buses_df immédiatement, donc les
        infras traitées après pourront s'y connecter si c'est le plus proche.
        """
        lat = float(infra.latitude)
        lon = float(infra.longitude)
        nom = str(infra.nom)

        # Nom unique : préfixe + nom de l'infra + id Python (évite collisions si même nom)
        bus_name = f"UserBus_{nom}_{id(infra)}"

        nearest_bus, dist_km, nearest_vnom = _find_nearest_bus(lat, lon, self._buses_df)
        if nearest_bus is None:
            logger.warning(
                "BusConnector : aucun bus existant trouvé pour '%s' — infra ignorée.", nom
            )
            return

        line_type = _line_type_for_vnom(nearest_vnom)

        # Ajouter le nouveau bus — hérite la tension du bus voisin
        new_bus = pd.DataFrame([{
            "name":         bus_name,
            "v_nom":        nearest_vnom,
            "type":         "prod",
            "x":            lat,
            "y":            lon,
            "control":      "PQ",
            "display_name": nom,
        }])
        self._buses_df = pd.concat([self._buses_df, new_bus], ignore_index=True)

        # Ajouter la ligne de raccordement au même niveau de tension
        line_name = f"UserLine_{nom}_{id(infra)}"
        new_line = pd.DataFrame([{
            "name":   line_name,
            "bus0":   bus_name,
            "bus1":   nearest_bus,
            "type":   line_type,
            "length": round(dist_km, 2),
            "s_nom":  _DEFAULT_S_NOM,
        }])
        self._lines_df = pd.concat([self._lines_df, new_line], ignore_index=True)

        logger.info(
            "BusConnector : '%s' → bus '%s' (%.0f kV, %s) connecté à '%s' (%.1f km).",
            nom, bus_name, nearest_vnom, line_type, nearest_bus, dist_km,
        )
