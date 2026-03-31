from harmoniq.core.base import Infrastructure, necessite_scenario
from harmoniq.modules.solaire.calculs_production_solaire import (
    calculate_energy_solar_plants,
    cost_solar_powerplant,
)


import pandas as pd
import numpy as np
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
    
    def calculer_cout_construction(self) -> np.ndarray:
        COST_PER_MW = 3_570_000  # $/MW
        return self.donnees.puissance_nominal * COST_PER_MW

    def calculer_cout_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        OPEX_PER_MW_PER_YEAR = 18_000  # $/MW/year
        HOURS_PER_YEAR = 8760

        annual_cost = self.donnees.puissance_nominal * OPEX_PER_MW_PER_YEAR
        hours = pas_de_temps.total_seconds() / 3600
        return annual_cost * (hours / HOURS_PER_YEAR)


    def calculer_co2_eq_construction(self) -> np.ndarray:
        # Really rought estimate, need to be improved
        return self.donnees.puissance_nominal * (CO2_PER_MW := 80)

    def calculer_co2_eq_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        # Really rought estimate, need to be improved
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        co2_intensity = 48 / 1000

        CAPACITY_FACTOR = 0.15
        HOURS_PER_YEAR = 8760
        annual_energy = self.donnees.puissance_nominal * HOURS_PER_YEAR * CAPACITY_FACTOR
        annual_co2 = annual_energy * co2_intensity
        hours = pas_de_temps.total_seconds() / 3600
        return annual_co2 * (hours / HOURS_PER_YEAR)


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
