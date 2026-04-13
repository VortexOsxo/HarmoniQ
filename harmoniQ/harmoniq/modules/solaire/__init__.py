from harmoniq.core.base import Infrastructure, necessite_scenario
from harmoniq.modules.solaire.calculs_production_solaire import (
    calculate_energy_solar_plants,
    PANELS_PAR_SCENARIO,
    SURFACE_PAR_PANNEAU_M2,
    calculate_installation_cost,
    co2_emissions_solar,
    cost_solar_powerplant,
    calculate_lifetime,
    calculate_base_production_per_m2,
    distribute_base_to_mrc,
    compute_facteur_densite,
    apply_residential_scenario,
)
from harmoniq.modules.solaire.data_solaire import (
    coordinates_residential_MRC,
    coordinates_residential,
    mrc_to_ra,
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

        # Mapping des clés frontend vers les clés Sandia du backend
        mapping_modules = {
            'CS6X_300M': 'Canadian_Solar_CS6X_300M__2013_',
            'CS5P_220M': 'Canadian_Solar_CS5P_220M___2009_',
            'SPR_315E': 'SunPower_SPR_315E_WHT__2007__E__',
            'SPR_305': 'SunPower_SPR_305_WHT__2007__E__',
        }
        
        module_ref = mapping_modules.get(self.donnees.materiau_panneau, 'Canadian_Solar_CS6X_300M__2013_')

        return calculate_energy_solar_plants(
            nom=self.donnees.nom,
            latitude=self.donnees.latitude,
            longitude=self.donnees.longitude,
            angle_panneau=self.donnees.angle_panneau,
            orientation_panneau=self.donnees.orientation_panneau,
            nombre_panneau=self.donnees.nombre_panneau,
            module_ref=module_ref,
            bifacial=(self.donnees.panneau_type == 'biface'),
            date_start=self.scenario.date_de_debut,
            date_end=self.scenario.date_de_fin + pd.DateOffset(days=1),
        )
    
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
        # 14 gCO2e/kWh lifetime × 8760 h × CF 0.15 × 25 yr / 1000 = 460 tCO2/MW
        CO2_PER_MW = 460  # tCO2/MW
        return self.donnees.puissance_nominal * CO2_PER_MW

    def calculer_co2_eq_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:  # noqa: ARG002
        # 0 gCO2e/kWh in operation — no combustion
        return 0.0

class InfraSolaireResidentielle:
    """
    Pipeline résidentiel en deux étapes :

      Étape 1 — Base W/m² (calculée une seule fois, indépendante du scénario)
        infra = InfraSolaireResidentielle()
        infra.calculer_base()           # ~99 appels PVGIS, résultat mis en cache
        infra.exporter_base_csv()       # sauvegarde pour réutilisation

      Étape 2 — Application du scénario (instantanée, nécessite la BD MRC)
        df = infra.get_production(
            scenario="neutre",          # "pessimiste" | "neutre" | "optimiste"
            mrc_data_df=...,            # DataFrame (mrc, population, superficie_km2)
            taux_adoption=0.05,
        )
        # df : (datetime, mrc, production_kw)
    """

    def __init__(
        self,
        surface_tilt: float = 30.0,
        surface_orientation: float = 180.0,
    ):
        self.surface_tilt = surface_tilt
        self.surface_orientation = surface_orientation
        self._base_production: pd.DataFrame | None = None

    def calculer_base(self, methode: str = "ra") -> pd.DataFrame:
        """
        Calcule et met en cache le profil TMY en W/m² pour toutes les MRC.
        À appeler une seule fois ; les appels suivants retournent le cache.

        Arguments :
            methode : "mrc" (défaut) → 99 appels PVGIS, profil solaire local par MRC
                      "ra"           → 17 appels PVGIS + distribution aux MRCs (plus rapide,
                                       toutes les MRCs d'une même RA partagent le même profil)

        Retour : DataFrame (datetime, mrc, production_w_per_m2) — 8760 lignes par MRC
        """
        if self._base_production is not None:
            return self._base_production

        if methode == "mrc":
            logger.info("Calcul base W/m² — méthode directe MRC (99 appels PVGIS)...")
            self._base_production = calculate_base_production_per_m2(
                coordinates=coordinates_residential_MRC,
                surface_tilt=self.surface_tilt,
                surface_orientation=self.surface_orientation,
            )
        elif methode == "ra":
            logger.info("Calcul base W/m² — méthode RA → MRC (17 appels PVGIS)...")
            ra_base = calculate_base_production_per_m2(
                coordinates=coordinates_residential,
                surface_tilt=self.surface_tilt,
                surface_orientation=self.surface_orientation,
            )
            self._base_production = distribute_base_to_mrc(ra_base, mrc_to_ra)
        else:
            raise ValueError(f"methode doit être 'mrc' ou 'ra', reçu: {methode!r}")

        logger.info("Base W/m² calculée.")
        return self._base_production

    def get_production(
        self,
        scenario: str,
        mrc_data_df: pd.DataFrame,
        total_clients: int = 125_000,
    ) -> pd.DataFrame:
        """
        Applique un scénario sur la base W/m².

        Arguments :
            scenario      : "pessimiste" | "neutre" | "optimiste"
            mrc_data_df   : DataFrame (mrc, population, superficie_km2) depuis la BD
            total_clients : nombre total de clients résidentiels (défaut 125 000)

        Retour : DataFrame (datetime, mrc, production_kw)

        Formule :
            nb_clients(mrc) = total_clients × population(mrc) / population_totale
            production_kW = production_w_per_m2 × nb_panneaux × 1.7 m² × nb_clients × f_densite / 1000
        """
        if self._base_production is None:
            self.calculer_base()

        m2_par_client = PANELS_PAR_SCENARIO[scenario] * SURFACE_PAR_PANNEAU_M2
        return apply_residential_scenario(
            base_df=self._base_production,
            m2_par_client=m2_par_client,
            mrc_data_df=mrc_data_df,
            total_clients=total_clients,
        )

    # def exporter_base_csv(self, path: str = "base_production_mrc.csv") -> None:
    #     """
    #     Exporte la base W/m² en CSV (une seule fois, réutilisable sans recalcul).
    #     Colonnes : datetime, mrc, production_w_per_m2
    #     """
    #     if self._base_production is None:
    #         self.calculer_base()
    #     self._base_production.to_csv(path, index=False)
    #     logger.info(f"Base exportée → {path}")


if __name__ == "__main__":
    # integration test using database entities
    from harmoniq.db.CRUD import read_all_solaire, read_all_scenario
    from harmoniq.db.engine import get_db
    import pandas as pd
    import os

    db = next(get_db())
    solaire = read_all_solaire(db)
    scenarios = read_all_scenario(db)

    if not solaire or not scenarios:
        logger.warning("Pas de données solaires ou de scénarios en base, rien à tester")
        exit(1)

    scenario = scenarios[0]
    logger.info(f"Utilisation du scénario {scenario.nom} ({scenario.date_de_debut} → {scenario.date_de_fin})")

    output_dir = os.getcwd()
    for centrale in solaire:
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

