from harmoniq.core.base import Infrastructure
from harmoniq.modules.nucleaire.calculs_production_nucleaire import (
    calculate_nuclear_production,
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



if __name__ == "__main__":
    from harmoniq.db.CRUD import read_all_nucleaire, read_all_scenario
    from harmoniq.db.engine import get_db

    db = next(get_db())
    centrale = read_all_nucleaire(db)[0]
    infraNucleaire = InfraNucleaire(centrale)

    scenario = read_all_scenario(db)[0]

    infraNucleaire.charger_scenario(scenario)

    production = infraNucleaire.calculer_production()
