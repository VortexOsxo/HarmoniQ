from dataclasses import dataclass
from typing import Any, Dict, List


REQUIRED_PRODUCTION_COLUMNS = [
    "timestamp",
    "totale",
    "total_eolien",
    "total_solaire",
    "total_hydro_fil",
    "total_hydro_reservoir",
    "total_import",
    "total_nucleaire",
    "total_thermique",
]


@dataclass
class SimulationRequest:
    """Contrat d'entree compatible avec l'endpoint REST actuel."""

    scenario_id: int
    liste_infra_id: int
    is_journalier: bool = False


@dataclass
class SimulationResponse:
    """Contrat de sortie compatible avec les usages frontend/backend actuels."""

    metadata: Dict[str, Any]
    production: List[Dict[str, Any]]
    line_flows: List[Dict[str, Any]]
    summary: Dict[str, Any]


def validate_production_records(records: List[Dict[str, Any]]) -> List[str]:
    """Valide la presence des colonnes minimales dans les enregistrements de production.

    Retourne une liste d'erreurs (vide si tout est valide).
    """
    if not records:
        return ["La liste `production` est vide."]

    errors: List[str] = []
    first = records[0]
    for col in REQUIRED_PRODUCTION_COLUMNS:
        if col not in first:
            errors.append(f"Colonne de sortie manquante: {col}")

    return errors
