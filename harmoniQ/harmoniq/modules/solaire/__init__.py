from harmoniq.core.base import Infrastructure, necessite_scenario
from harmoniq.modules.solaire.calculs_production_solaire import (
    calculate_energy_solar_plants,
    cost_solar_powerplant,
)


import pandas as pd
import logging

logger = logging.getLogger("Solaire")


class InfraSolaire(Infrastructure):
    def calculer_production(self) -> pd.DataFrame:
        nom = self.donnees.nom
        logger.info(f"Calcul de la production pour {nom}")

        return calculate_energy_solar_plants(
            nom=self.donnees.nom,
            latitude=self.donnees.latitude,
            longitude=self.donnees.longitude,
            angle_panneau=self.donnees.angle_panneau,
            orientation_panneau=self.donnees.orientation_panneau,
            puissance_nominal=self.donnees.puissance_nominal,
            nombre_panneau=self.donnees.nombre_panneau,
            date_start=self.scenario.date_de_debut,
            date_end=self.scenario.date_de_fin + pd.DateOffset(days=1),
        )
    
    @necessite_scenario
    def calculer_cout_construction(self):
        self.couts  = cost_solar_powerplant(puissance_mw=self.donnees.puissance_nominal)
        return self.couts
    
    


if __name__ == "__main__":
    from harmoniq.db.CRUD import read_all_solaire, read_all_scenario
    from harmoniq.db.engine import get_db

    db = next(get_db())
    centrale = read_all_solaire(db)[0]
    infraSolaire = InfraSolaire(centrale)

    scenario = read_all_scenario(db)[0]

    infraSolaire.charger_scenario(scenario)

    production = infraSolaire.calculer_production()

    cout = infraSolaire.calculer_cout_construction()
