from harmoniq.core.base import Infrastructure, necessite_scenario
from harmoniq.db.schemas import ThermiqueBase, ScenarioBase
from harmoniq.modules.thermique.calculs_production_thermique import (
    calculate_thermique_production, assign_maintenance_weeks
)

import pandas as pd
import numpy as np
import logging

logger = logging.getLogger("Thermique")


class InfraThermique(Infrastructure):
    def __init__(self, donnees: ThermiqueBase):

        super().__init__(donnees)
        self.donnees:ThermiqueBase = donnees
        self.production: pd.DataFrame = None

    def charger_scenario(self, scenario: ScenarioBase, toutes_les_centrales: list["InfraThermique"]):
        self.scenario: ScenarioBase = scenario
        self.production = None
        semaines = assign_maintenance_weeks(len(toutes_les_centrales))
        # Retrouver la position de cette centrale dans la liste
        index = toutes_les_centrales.index(self)
        self._maintenance_week = semaines[index]

    @necessite_scenario
    def calculer_production(self) -> pd.DataFrame:
        nom = self.donnees.nom
        logger.info(f"Calcul de la production pour {nom}")


        return calculate_thermique_production(
            power_mw=self.donnees.puissance_nominal,
            maintenance_week=self._maintenance_week,
            date_start=self.scenario.date_de_debut,
            date_end=self.scenario.date_de_fin,
            name=self.donnees.nom,
            fuel_type=self.donnees.type_intrant,
        )
        return self.production

    def calculer_cout_construction(self) -> np.ndarray:
        COST_PER_MW = 3_440_000  # $/MW
        return self.donnees.puissance_nominal * COST_PER_MW

    def calculer_cout_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        OPEX_PER_MW_PER_YEAR = 44_000  # $/MW/year
        HOURS_PER_YEAR = 8760

        annual_cost = self.donnees.puissance_nominal * OPEX_PER_MW_PER_YEAR
        hours = pas_de_temps.total_seconds() / 3600
        return annual_cost * (hours / HOURS_PER_YEAR)

    def calculer_co2_eq_construction(self) -> np.ndarray:
        CO2_PER_MW = 27.5  # tCO2/MW installé
        return self.donnees.puissance_nominal * CO2_PER_MW

    def calculer_co2_eq_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        co2_intensity = 1.2 / 1000  # 1.2 gCO2e/kWh → tCO2/MWh

        CAPACITY_FACTOR = 0.60
        HOURS_PER_YEAR = 8760
        MAINTENANCE_HOURS = 7 * 24

        annual_energy = (
            self.donnees.puissance_nominal
            * (HOURS_PER_YEAR - MAINTENANCE_HOURS)
            * CAPACITY_FACTOR
        )

        annual_co2 = annual_energy * co2_intensity
        hours = pas_de_temps.total_seconds() / 3600
        return annual_co2 * (hours / HOURS_PER_YEAR)


if __name__ == "__main__":
    from harmoniq.db.CRUD import read_all_thermique, read_all_scenario
    from harmoniq.db.engine import get_db

    db = next(get_db())
    centrale = read_all_thermique(db)[0]
    infraThermique = InfraThermique(centrale)

    scenario = read_all_scenario(db)[0]

    infraThermique.charger_scenario(scenario, toutes_les_centrales=[infraThermique])

    production = infraThermique.calculer_production()
    print(production)