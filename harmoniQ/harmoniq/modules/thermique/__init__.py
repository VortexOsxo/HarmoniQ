from harmoniq.core.base import Infrastructure, necessite_scenario
from harmoniq.db.schemas import ThermiqueBase, ScenarioBase
from harmoniq.modules.thermique.calculs_production_thermique import (
    calculate_thermique_production, assign_maintenance_weeks
)

import pandas as pd
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
        if self.production is not None:
            return self.production

        nom = self.donnees.nom
        logger.info(f"Calcul de la production pour {nom}")


        self.production = calculate_thermique_production(
            power_mw=self.donnees.puissance_nominal,
            maintenance_week=self._maintenance_week,
            date_start=self.scenario.date_de_debut,
            date_end=self.scenario.date_de_fin,
            name=self.donnees.nom,
            fuel_type=self.donnees.type_intrant,
        )
        return self.production


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