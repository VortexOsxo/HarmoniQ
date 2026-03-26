from harmoniq.core.base import Infrastructure, necessite_scenario
from harmoniq.db.schemas import HydroBase
from harmoniq.modules.hydro.calcule import (
    get_run_of_river_dam_power,
    estimation_cout_barrage,
    estimer_qualite_ecosysteme_futur,
    estimer_daly_futur,
    calculer_emissions_et_ressources,
    get_facteur_de_charge,
    get_energy,
)
import pandas as pd
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
from typing import List
from fastapi import HTTPException

CURRENT_DIR = Path(__file__).parent
DEBIT_DIR = CURRENT_DIR / "debits"
APPORT_DIR = CURRENT_DIR / "apport_naturel"


class InfraHydro(Infrastructure):

    def __init__(self, donnees: List[HydroBase]):
        super().__init__(donnees)
        self.debit = None
        self.apport = None
        self.cout = None
        self.qualite_ecosysteme = None
        self.daly = None

    @necessite_scenario
    def charger_debit(self):  # Seulement pour les barrages au fil de l'Eau
        filename_debit = str(self.donnees.nom) + ".csv"
        start_date = self.scenario.date_de_debut
        end_date = self.scenario.date_de_fin
        pas_temps = self.scenario.pas_de_temps
    
        if self.donnees.nom == "Beauharnois_Francis":
            debit = pd.read_csv(filepath_or_buffer=DEBIT_DIR / "Beauharnois.csv")
            debit["dateTime"] = pd.to_datetime(debit["dateTime"])
            debit = debit[
                (debit["dateTime"] >= start_date) & (debit["dateTime"] <= end_date)
                ]
            if pas_temps.seconds == 3600:
                date_repetee = np.repeat(debit["dateTime"].values,24)
                offset = np.tile(pd.to_timedelta(np.arange(24), unit="h"), len(debit))
                temps = date_repetee + offset
                debit_repete = np.repeat(debit["Beauharnois"].values, 24)
                debit_df = pd.DataFrame({"dateTime":temps, "Beauharnois" : debit_repete})
                debit_df = debit_df.set_index("dateTime")
                self.debit = debit_df[["Beauharnois"]] * (26 / 36)
            else:
                debit = debit.set_index("dateTime")            
                self.debit = debit[["Beauharnois"]] * (26 / 36)                                
        elif self.donnees.nom == "Beauharnois_Kaplan":
            debit = pd.read_csv(filepath_or_buffer=DEBIT_DIR / "Beauharnois.csv")
            debit["dateTime"] = pd.to_datetime(debit["dateTime"])
            debit = debit[
                (debit["dateTime"] >= start_date) & (debit["dateTime"] <= end_date)
            ]
            if pas_temps.seconds == 3600:
                date_repetee = np.repeat(debit["dateTime"].values,24)
                offset = np.tile(pd.to_timedelta(np.arange(24), unit="h"), len(debit))
                temps = date_repetee + offset
                debit_repete = np.repeat(debit["Beauharnois"].values, 24)
                debit_df = pd.DataFrame({"dateTime":temps, "Beauharnois" : debit_repete})
                debit_df = debit_df.set_index("dateTime")
                self.debit = debit_df[["Beauharnois"]] * (10 / 36)
            else:
                debit = debit.set_index("dateTime")            
                self.debit = debit[["Beauharnois"]] * (10 / 36)
        else:
            debit = pd.read_csv(filepath_or_buffer=DEBIT_DIR / filename_debit)
            debit["dateTime"] = pd.to_datetime(debit["dateTime"])
            debit = debit[
                (debit["dateTime"] >= start_date) & (debit["dateTime"] <= end_date)
            ]
            if pas_temps.seconds == 3600:
                date_repetee = np.repeat(debit["dateTime"].values,24)
                offset = np.tile(pd.to_timedelta(np.arange(24), unit="h"), len(debit))
                temps = date_repetee + offset
                debit_repete = np.repeat(debit[self.donnees.nom].values, 24)
                debit_df = pd.DataFrame({"dateTime":temps, self.donnees.nom : debit_repete})
                debit_df = debit_df.set_index("dateTime")
                self.debit = debit_df[[self.donnees.nom]]   
            else:
                debit = debit.set_index("dateTime")
                self.debit = debit[[self.donnees.nom]]

    def _charger_apport(self):  # Fonctionne
        start_date = "2025-01-01"
        end_date = "2026-01-01"
        id_HQ = str(self.donnees.id_HQ)
        filename_apport = id_HQ + ".csv"
        apport = pd.read_csv(filepath_or_buffer=APPORT_DIR / filename_apport)
        apport["time"] = pd.to_datetime(apport["time"])
        self.apport = apport[
            (apport["time"] >= start_date) & (apport["time"] <= end_date)
        ]

    def calculer_production(self) -> pd.DataFrame:  # Fonctionne
        if self.donnees.type_barrage == "Fil de l'eau":
            self.charger_debit()
            return get_run_of_river_dam_power(self)

        raise HTTPException(
                status_code=400, detail="Production calculation is only available for run-of-river dams"
            )
  
    def calculer_energie(self, production):
        return get_energy(production)

    def calculer_facteur_charge(self, production):  # Fonctionne
        return get_facteur_de_charge(self, production)

    def calculer_cout_construction(self) -> np.ndarray:  # Fonctionne
        return estimation_cout_barrage(self)

    def PDF_environnement(self, facteur_charge):  # Fonctionne
        return estimer_qualite_ecosysteme_futur(facteur_charge)

    def daly_futur(self, facteur_charge):  # Fonctionne
        return estimer_daly_futur(facteur_charge)

    def emission(self, energie, facteur_charge):  # Fonctionne
        return calculer_emissions_et_ressources(self, energie, facteur_charge)

    def calculer_cout_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        # Really rought estimate, need to be improved
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        CAPACITY_FACTOR = 0.50
        OPEX_PER_MWH = 20

        HOURS_PER_YEAR = 8760

        availability = 1 - (
            self.donnees.nb_turbines_maintenance / self.donnees.nb_turbines
        )

        annual_energy = (
            self.donnees.puissance_nominal
            * HOURS_PER_YEAR
            * CAPACITY_FACTOR
            * availability
        )

        annual_cost = annual_energy * OPEX_PER_MWH
        hours = pas_de_temps.total_seconds() / 3600
        return annual_cost * (hours / HOURS_PER_YEAR)


    def calculer_co2_eq_construction(self) -> np.ndarray:
        # Really rought estimate, need to be improved
        return self.donnees.puissance_nominal * (CO2_PER_MW := 400)

    def calculer_co2_eq_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        # Really rought estimate, need to be improved
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        if self.donnees.type_barrage == "Fil de l'eau":
            co2_intensity = 6 / 1000
        else:
            co2_intensity = 17 / 1000

        CAPACITY_FACTOR = 0.50
        HOURS_PER_YEAR = 8760
        availability = 1 - (
            self.donnees.nb_turbines_maintenance / self.donnees.nb_turbines
        )

        annual_energy = (
            self.donnees.puissance_nominal
            * HOURS_PER_YEAR
            * CAPACITY_FACTOR
            * availability
        )

        annual_co2 = annual_energy * co2_intensity
        hours = pas_de_temps.total_seconds() / 3600
        return annual_co2 * (hours / HOURS_PER_YEAR)


if __name__ == "__main__":

    from harmoniq.modules.hydro import InfraHydro
    from harmoniq.db.CRUD import read_all_hydro, read_all_scenario
    from harmoniq.db.engine import get_db

    db = next(get_db())
    centrale = read_all_hydro(db)[4]
    infraHydro = InfraHydro(centrale)

    scenario = read_all_scenario(db)[0]
    print(f"Scenario: {scenario.nom}, type barrage: {centrale.type_barrage}")

    infraHydro.charger_scenario(scenario)
    infraHydro.calculer_production()
    print(infraHydro.production)