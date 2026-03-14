from harmoniq.core.base import Infrastructure
from harmoniq.modules.thermique.calculs_production_thermique import (
    calculate_thermique_production,
)

import pandas as pd
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

if __name__ == "__main__":
    from harmoniq.db.CRUD import read_all_thermique, read_all_scenario
    from harmoniq.db.engine import get_db

    db = next(get_db())
    centrale = read_all_thermique(db)[0]
    infraThermique = InfraThermique(centrale)

    scenario = read_all_scenario(db)[0]

    infraThermique.charger_scenario(scenario)

    production = infraThermique.calculer_production()
