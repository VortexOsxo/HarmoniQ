from harmoniq.core.base import Infrastructure, necessite_scenario
from harmoniq.modules.solaire.calculs_production_solaire import (
    calculate_energy_solar_plants,
    calculate_regional_residential_solar,
    precalculate_residential_scenarios,
    PANELS_PAR_SCENARIO,
    calculate_installation_cost,
    co2_emissions_solar,
    cost_solar_powerplant,
    calculate_lifetime,
)
from harmoniq.modules.solaire.data_solaire import (
    coordinates_residential,
    population_relative,
)


import pandas as pd
import numpy as np
import logging

# configure basic logging so that logger.info() messages are visible in stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(name)s %(levelname)s: %(message)s',
)
logger = logging.getLogger("Solaire")
logger.setLevel(logging.INFO)  # ensure the local logger propagates to root


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


class InfraSolaireResidentielle:
    """
    Encapsule la production solaire résidentielle pour tous les scénarios.

    Utilisation :
        infra = InfraSolaireResidentielle(total_clients=150_000)
        infra.charger_scenario(scenario)
        infra.calculer_production()          # pré-calcule pessimiste/neutre/optimiste

        df = infra.get_production("optimiste")   # profil horaire pour le frontend
        summary = infra.get_summary("neutre")  # récapitulatif par région
    """

    def __init__(
        self,
        total_clients: int = 150_000,
        surface_tilt: float = 30.0,
        surface_orientation: float = 180.0,
    ):
        self.total_clients = total_clients
        self.surface_tilt = surface_tilt
        self.surface_orientation = surface_orientation
        self.scenario = None
        self._productions: dict = {}   # {"pessimiste": (prod_df, summary_df), ...}

    def charger_scenario(self, scenario):
        self.scenario = scenario
        self._productions = {}  # reset du cache si le scénario change

    @necessite_scenario
    def calculer_production(self) -> dict:
        """
        Pré-calcule les 3 scénarios (pessimiste/neutre/optimiste) une seule fois.
        Les résultats sont mis en cache — appels suivants retournent le cache.
        Retour : dict {"pessimiste": (prod_df, summary_df), ...}
        """
        if not self._productions:
            logger.info(
                f"Pre-calcul des 3 scenarios residentiels ({self.total_clients} clients)..."
            )
            self._productions = precalculate_residential_scenarios(
                coordinates_residential=coordinates_residential,
                population_relative=population_relative,
                total_clients=self.total_clients,
                surface_tilt=self.surface_tilt,
                surface_orientation=self.surface_orientation,
                date_start=self.scenario.date_de_debut,
                date_end=self.scenario.date_de_fin + pd.DateOffset(days=1),
            )
            logger.info("Pre-calcul termine.")
        return self._productions

    def get_production(self, scenario: str = "neutre") -> pd.DataFrame:
        """
        Retourne le profil horaire (production kW) pour un scénario donné.
        Déclenche le pré-calcul si ce n'est pas déjà fait.
        """
        if not self._productions:
            self.calculer_production()
        prod_df, _ = self._productions[scenario]
        return prod_df

    def get_summary(self, scenario: str = "neutre") -> pd.DataFrame:
        """
        Retourne le récapitulatif par région (puissance installée, énergie annuelle)
        pour un scénario donné.
        """
        if not self._productions:
            self.calculer_production()
        _, summary_df = self._productions[scenario]
        return summary_df

    def exporter_csv(self, dossier: str = ".") -> None:
        """
        Exporte un CSV de production horaire par scénario (pessimiste/neutre/optimiste).
        Fichiers générés : resid_production_pessimiste.csv, resid_production_neutre.csv,
                           resid_production_optimiste.csv
        """
        import os
        if not self._productions:
            self.calculer_production()
        for sc, (prod_df, _) in self._productions.items():
            path = os.path.join(dossier, f"resid_production_{sc}.csv")
            prod_df.to_csv(path, index=False)
            logger.info(f"Exporte {path}")


if __name__ == "__main__":
    # integration test using database entities
    from harmoniq.db.CRUD import read_all_solaire, read_all_scenario
    from harmoniq.db.engine import get_db
    import pandas as pd
    import os

    db = next(get_db())
    solaires = read_all_solaire(db)
    scenarios = read_all_scenario(db)

    if not solaires or not scenarios:
        logger.warning("Pas de données solaires ou de scénarios en base, rien à tester")
        exit(1)

    scenario = scenarios[0]
    logger.info(f"Utilisation du scénario {scenario.nom} ({scenario.date_de_debut} → {scenario.date_de_fin})")

    output_dir = os.getcwd()
    for centrale in solaires:
        logger.info(f"--- Traitement de la centrale {centrale.nom} ---")
        infra = InfraSolaire(centrale)
        infra.charger_scenario(scenario)

        production = infra.calculer_production()
        logger.info(f"Production calculée (quelques lignes) :\n{production.head()}")
        # export excel pour vérification
        file_name = f"production_{centrale.nom.replace(' ', '_')}.xlsx"
        production.to_excel(os.path.join(output_dir, file_name))
        logger.info(f"Exporté {file_name} dans {output_dir}")

        cout = infra.calculer_cout_construction()
        logger.info(f"Coût de construction : {cout}")

    # fin du script
    logger.info("Tests d'intégration terminés")
    
    # if __name__ == "__main__":
    # from harmoniq.db.CRUD import read_all_solaire, read_all_scenario
    # from harmoniq.db.engine import get_db

    # db = next(get_db())
    # centrale = read_all_solaire(db)[0]
    # infraSolaire = InfraSolaire(centrale)

    # scenario = read_all_scenario(db)[0]

    # infraSolaire.charger_scenario(scenario)

    # production = infraSolaire.calculer_production()

    # cout = infraSolaire.calculer_cout_construction()

