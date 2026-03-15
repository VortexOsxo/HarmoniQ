from harmoniq.core.base import Infrastructure
from harmoniq.modules.thermique.calculs_production_thermique import (
    calculate_thermique_production,
)

import pandas as pd
import numpy as np
import logging

logger = logging.getLogger("Thermique")


class InfraThermique(Infrastructure):
    def calculer_production(self) -> pd.DataFrame:
        nom = self.donnees.nom
        logger.info(f"Calcul de la production pour {nom}")


        return calculate_thermique_production(
            power_mw=self.donnees.puissance_nominal,
            maintenance_week=self.donnees.semaine_maintenance,
            date_start=self.scenario.date_de_debut,
            date_end=self.scenario.date_de_fin,
        )

    def calculer_cout_construction(self) -> np.ndarray:
        # Really rought estimate, need to be improved
        COST_PER_MW = 1_200_000  # CAD par MW
        return self.donnees.puissance_nominal * COST_PER_MW

    def calculer_cout_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        # Really rought estimate, need to be improved
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        CAPACITY_FACTOR = 0.60
        OPEX_PER_MWH = 70

        HOURS_PER_YEAR = 8760
        MAINTENANCE_HOURS = 7 * 24

        annual_energy = (
            self.donnees.puissance_nominal
            * (HOURS_PER_YEAR - MAINTENANCE_HOURS)
            * CAPACITY_FACTOR
        )

        annual_cost = annual_energy * OPEX_PER_MWH
        hours = pas_de_temps.total_seconds() / 3600
        return annual_cost * (hours / HOURS_PER_YEAR)

if __name__ == "__main__":
    from harmoniq.db.CRUD import read_all_thermique, read_all_scenario
    from harmoniq.db.engine import get_db

    db = next(get_db())
    centrale = read_all_thermique(db)[0]
    infraThermique = InfraThermique(centrale)

    scenario = read_all_scenario(db)[0]

    infraThermique.charger_scenario(scenario)

    production = infraThermique.calculer_production()
