from harmoniq.core.base import Infrastructure
from harmoniq.modules.nucleaire.calculs_production_nucleaire import (
    calculate_nuclear_production,
    cost_nuclear_powerplant
)

import pandas as pd
import logging

logger = logging.getLogger("Nucleaire")


class InfraNucleaire(Infrastructure):
    def calculer_production(self) -> pd.DataFrame:
        nom = self.donnees.nom
        logger.info(f"Calcul de la production pour {nom}")

        return calculate_nuclear_production(
            power_mw=self.donnees.puissance_nominal,
            maintenance_week=self.donnees.semaine_maintenance,
            date_start=self.scenario.date_de_debut,
            date_end=self.scenario.date_de_fin,
        )

def calculer_cout_construction(self) -> np.ndarray:
    return cost_nuclear_powerplant(self.donnees.puissance_nominal)


def calculer_cout_annuel(self) -> np.ndarray:
    # Really rought estimate, need to be improved
    CAPACITY_FACTOR = 0.90
    OPEX_PER_MWH = 100

    HOURS_PER_YEAR = 8760
    MAINTENANCE_HOURS = 7 * 24

    annual_energy = (
        self.donnees.puissance_nominal
        * (HOURS_PER_YEAR - MAINTENANCE_HOURS)
        * CAPACITY_FACTOR
    )

    return annual_energy * OPEX_PER_MWH


if __name__ == "__main__":
    from harmoniq.db.CRUD import read_all_nucleaire, read_all_scenario
    from harmoniq.db.engine import get_db

    db = next(get_db())
    centrale = read_all_nucleaire(db)[0]
    infraNucleaire = InfraNucleaire(centrale)

    scenario = read_all_scenario(db)[0]

    infraNucleaire.charger_scenario(scenario)

    production = infraNucleaire.calculer_production()
