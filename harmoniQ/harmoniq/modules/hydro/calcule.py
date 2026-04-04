import pandas as pd
import numpy as np
import HydroGenerate as hg
from pathlib import Path
from HydroGenerate.hydropower_potential import calculate_hp_potential
from harmoniq.db.engine import get_db
from harmoniq.db.CRUD import read_all_hydro

CURRENT_DIR = Path(__file__).parent
APPORT_DIR = CURRENT_DIR / "apport_naturel"

# === Load catch coefficients
CSVDIR = Path(__file__).parent.parent.parent
HYDRO_INFO_PATH = CSVDIR / "db" / "CSVs" / "Info_Barrages.csv"
catch_coeff_map = pd.read_csv(HYDRO_INFO_PATH).set_index("Nom")["catch_coefficient"].to_dict()

def reservoir_infill(
    besoin_puissance, pourcentage_reservoir, apport_naturel, timestamp
):
    db = next(get_db())
    barrages = read_all_hydro(db)
    Units = "IS"
    hp_type = "Diversion"
    results = {}

    for i in range(0, len(barrages)):
        type_barrage = barrages[i].type_barrage
        # barrage_amont = dam_data["amont"].values[0]
        # debit_amont = barrages_df["id"== barrage_amont].values[0]

        if type_barrage == "Fil de l'eau":
            print("Erreur : Le barrage entré n'est pas un barrage à réservoir")
        else:
            nom = barrages[i].barrage_nom
            besoin = besoin_puissance[nom].iloc[0]  # Get power needs for this dam
            # Get dam-specific values from barrages_df
            dam_data = barrages[i]
            volume_remplie = dam_data.volume_reservoir
            debit_nom = dam_data.debits_nominal
            head = dam_data.hauteur_chute
            nb_turb_maintenance = dam_data.nb_turbines_maintenance
            nb_turbines = dam_data.nb_turbines - nb_turb_maintenance
            type_turb = dam_data.modele_turbine
            apport = apport_naturel.loc[timestamp, nom]
            apport = apport_naturel.loc[timestamp, nom]
            catch_coeff = catch_coeff_map.get(nom, 1.0)  # default to 1.0
            apport *= catch_coeff
            
            # debit_amont = get_upstream_flows(temps,df_debit,barrage_amont)
            volume_reel = (
                volume_remplie * pourcentage_reservoir + apport * 3600
            )  # Ajouter le debit en amont

            hp = calculate_hp_potential(
                flow=debit_nom,
                design_flow=debit_nom,
                head=head,
                units=Units,
                hydropower_type=hp_type,
                turbine_type=type_turb,
                annual_maintenance_flag=False,
            )
            hp.power /= 1000  # MW
            for i in range(0, len(hp.power)):
                if (
                    besoin_puissance < hp.power[0]
                ):  # Toujours une turbine active pour que la rivière puisse continuer à
                    nb_turbines_a = 1
                    debits_turb = debit_nom
                    break
                else:
                    nb_turbines_actives = hp.power / besoin
                    if (
                        nb_turbines > nb_turbines_actives[i]
                        and hp.flow[i] - debit_nom < 0.1
                        and hp.flow[i] - debit_nom > 0
                        and besoin < hp.power[-1]
                    ):
                        nb_turbines_a = nb_turbines_actives[i]
                        debits_turb = hp.flow[i]
                        break

                    elif besoin > hp.power[-1]:
                        nb_turbines_a = nb_turbines
                        debits_turb = hp.flow[-1]
                        break

            if volume_reel - debits_turb * nb_turbines_a * 3600 > volume_remplie:
                results[nom] = 1
                Volume_evacue = (
                    volume_reel + debits_turb * nb_turbines_a * 3600 - volume_remplie
                )
            else:
                results[nom] = (
                    volume_reel - (debits_turb * nb_turbines_a * 3600)
                ) / volume_remplie

            pourcentage_reservoir_df = pd.DataFrame([results])
            # debit_turb_df = pd.DataFrame([debits_turb*nb_turbines_a*3600])

    return pourcentage_reservoir_df  # Possible d'ajouter une fonctionnalité permettant de calculer l'énergie perdue après l'utilisation d'un évacuateur de crue pour l'analyse de résultat


def charger_apport_reservoir(
    start_date, end_date
):  # Pour réseau pas utiliser dans la classe Hydro
    db = next(get_db())
    barrages = read_all_hydro(db)
    # barrages_df = pd.DataFrame([vars(b) for b in barrages])
    df_apport = pd.DataFrame()
    for i in range(0, len(barrages)):
        if barrages[i].type_barrage == "Reservoir":
            data_barrage = barrages[i]
            id_HQ = data_barrage.id_HQ
            nom_fichier = str(id_HQ) + ".csv"
            apport = pd.read_csv(filepath_or_buffer=APPORT_DIR / nom_fichier)
            apport["time"] = pd.to_datetime(apport["time"])
            apport = apport[
                (apport["time"] >= start_date) & (apport["time"] <= end_date)
            ]
            if i == 0:
                df_apport["time"] = apport["time"]
            date_repetee = np.repeat(apport["time"].values, 24)
            offset = np.tile(pd.to_timedelta(np.arange(24), unit="h"), len(apport))
            temps = date_repetee + offset
            apport_repete = np.repeat(apport["streamflow"].values, 24)
            apport_re = pd.DataFrame(
                {"time": temps, data_barrage.barrage_nom: apport_repete}
            )
            if df_apport.empty:
                df_apport = apport_re
            else:
                df_apport = pd.merge(df_apport, apport_re, on="time", how="outer")
    df_apport.set_index("time")

    return df_apport


# def store_flows(Volume_evacue, debits_turb, df_debit, id_barrage): #pas implémenté

#     df_temp = pd.DataFrame({"id_barrage"})
#     df_debit.append() = Volume_evacue
#     df_debit.debits_turb = debits_turb

#     return df_debit

# def get_upstream_flows(df_debit):

#     flow =

#     return flow


def get_run_of_river_dam_power(barrage):

    # db = next(get_db())
    # barrages = read_all_hydro(db)
    # barrages_df = pd.DataFrame([barrages.__dict__ for barrage in barrages])
    # barrages_df = barrages_df[barrage.nom]

    nom_barrage = barrage.donnees.nom  # Changer pour un id
    debit_nom = barrage.donnees.debits_nominal
    head = barrage.donnees.hauteur_chute
    nb_turb_maintenance = barrage.donnees.nb_turbines_maintenance
    nb_turbines = barrage.donnees.nb_turbines - nb_turb_maintenance
    P_nom = barrage.donnees.puissance_nominal * 1000 / (nb_turbines + nb_turb_maintenance)
    type_turb = barrage.donnees.modele_turbine
    type_barrage = barrage.donnees.type_barrage
    debit = barrage.debit
    Units = "IS"
    hp_type = "Diversion"
    # print(debit)

    if type_barrage == "Reservoir":
        print("Erreur : Le barrage entré n'est pas un barrage au fil de l'eau")
    else:
        if nom_barrage == "Beauharnois_Francis" or nom_barrage == "Beauharnois_Kaplan":
            debit["Beauharnois"] /= nb_turbines
            hp = calculate_hp_potential(
                flow=debit,
                flow_column="Beauharnois",
                design_flow=debit_nom,
                head=head,
                rated_power=P_nom,
                units=Units,
                hydropower_type=hp_type,
                turbine_type=type_turb,
                annual_caclulation=True,
                annual_maintenance_flag=False,
            )
        else:
            debit[nom_barrage] /= nb_turbines
            hp = calculate_hp_potential(
                flow=debit,
                flow_column=nom_barrage,
                design_flow=debit_nom,
                rated_power=P_nom,
                head=head,
                units=Units,
                hydropower_type=hp_type,
                turbine_type=type_turb,
                annual_caclulation=True,
                annual_maintenance_flag=False,
            )            
            
        hp.dataframe_output["power_MW"] = (
            hp.dataframe_output["power_kW"] * (nb_turbines - nb_turb_maintenance)
        ) / 1000
        barrage.production = hp.dataframe_output["power_MW"]
        return hp.dataframe_output["power_MW"]


def get_facteur_de_charge(barrage, production):
    facteur_charge = (production.values.sum()) / (
        barrage.donnees.puissance_nominal * len(production)
    )
    return facteur_charge


def get_energy(production):
    energy_r = production.values.sum()
    return energy_r


def energy_loss(
    Volume_evacue, Debits_nom_m3s, type_turb, nb_turbines, head, nb_turbine_maintenance
):

    # Fonction permettant de calculer la perte d'énergie causé par l'activation d'un évacuateur de crue en MWh
    # Variable en entrée :
    #   - info_barrage : Dataframe contenant les informations des barrages extraite du csv Info_Barrages.csv. Les colonnes du dataframe utilisées dans la fonction sont les suivantes
    #       - Nom : Nom du barrage [string]
    #       - Type : Type du barrage ["Fil de l'eau" vs "Reservoir" (string)]
    #       - Debits_nom_m3s : Debit d'équipement des turbines en m^3/s [float]
    #       - Nb_turbines : Nombre de turbines installée dans le barrage [float]
    #       - Type_turbine : Type de turbine installée dans les barrages [string]
    #   - nom_barrage : Nom du barrage étudié [string]
    #   - Volume_evacue : Volume d'eau évacué sur une heure par l'évacuateur de crue en m^3/h  [float]
    #   - nb_turbine_maintenance : Nombre de turbine en maintenance dans le barrage [int]
    # Variable en sortie :
    #   - energy_loss : Énergie perdue par l'utilisation de l'évacuateur de crue

    Units = "IS"
    hp_type = "Diversion"
    Debit = Volume_evacue / (
        3600 * nb_turbines
    )  # Conversion du débit évacué de m^3/h en m^3/s pour le calcul de puissance

    hp = calculate_hp_potential(
        flow=Debit,
        design_flow=Debits_nom_m3s,
        head=head,
        units=Units,
        hydropower_type=hp_type,
        turbine_type=type_turb,
        annual_maintenance_flag=False,
    )

    energy_loss = hp.power[-1] * (nb_turbines - nb_turbine_maintenance) / 1000

    return energy_loss


# Fonction d'estimation basée sur la régression log-log
def estimation_cout_barrage(barrage):
    if barrage.donnees.type_barrage == "Fil de l'eau":
        COST_PER_MW = 7_000_000   # $/MW
    else:
        COST_PER_MW = 14_000_000  # $/MW (réservoir)
    return barrage.donnees.puissance_nominal * COST_PER_MW


def estimer_qualite_ecosysteme_futur(facteur_charge):
    """
    Estime l'impact futur sur la qualité des écosystèmes en fonction du facteur de charge d'un nouveau barrage hydroélectrique.
    :param facteur_charge: Facteur de charge du nouveau barrage (valeur entre 0 et 1).
    :return: Estimation de l'impact futur sur la qualité des écosystèmes (PDF*m²*yr/kWh).
    """
    # Pourcentages de l'hydroélectricité dans chaque région
    mix_energie_hydro = {
        "Hydro-Québec": 97.6,
        "Vermont": 16.88,
        "Maine": 25.87,
        "New York": 18.16,
        "Connecticut": 0.86,
        "New Hampshire": 6.69,
        "Massachusetts": 2.52,
        "Rhode Island": 0.05,
    }

    # Qualité des écosystèmes total observé (extrait de la Figure 2)
    qualite_ecosysteme_total = {
        "Hydro-Québec": 17,
        "Vermont": 37,
        "Maine": 396,
        "New York": 389,
        "Connecticut": 388,
        "New Hampshire": 387,
        "Massachusetts": 612,
        "Rhode Island": 735,
    }

    # Transformation des données pour résoudre le système d'équations
    A = []
    B = []

    for region, mix in mix_energie_hydro.items():
        A.append([mix / 100])  # Conversion en proportion
        B.append(qualite_ecosysteme_total[region])

    # Conversion en matrices numpy
    A = np.array(A)
    B = np.array(B)

    # Résolution du système A * X = B pour trouver l'impact de l'hydroélectricité
    X = np.linalg.lstsq(A, B, rcond=None)[0]

    # Production actuelle et future (en % du mix énergétique du Québec)
    production_actuelle = mix_energie_hydro["Hydro-Québec"] / 100
    production_future = production_actuelle + facteur_charge * (1 - production_actuelle)

    # Estimation de l'impact futur sur la qualité des écosystèmes
    qualite_ecosysteme_futur = X[0] * production_future

    return qualite_ecosysteme_futur


def calculer_emissions_et_ressources(barrage, energie, facteur_charge):
    # Mise à jour des facteurs d'émission
    FACTEUR_EMISSION = {
        "Fil de l'eau": 6,  # g éq CO2/kWh
        "Reservoir": 17,  # g éq CO2/kWh
    }

    # Mise à jour des ressources minérales et énergies non renouvelables
    UTILISATION_MINERALES = {"Fil de l'eau": 0.019, "Reservoir": 0.019}  # mg Sb eq/kWh

    UTILISATION_NON_RENOUVELABLES = {"Fil de l'eau": 0.03, "Reservoir": 0.03}  # MJ/kWh

    # Valeurs de référence des ressources minérales déjà définies
    UTILISATION_FIL_EAU = 0.001  # kg indisponible/kWh pour hydro fil de l'eau
    UTILISATION_RESERVOIR = 0.0005  # kg indisponible/kWh pour hydro réservoir
    EXTRACTION_MINERALE = 0.031  # mg Sb/kWh pour l'extraction

    resultats = []

    type_barrage = barrage.donnees.type_barrage

    # Sélection des bons facteurs
    facteur_emission = FACTEUR_EMISSION.get(type_barrage, 0)
    energie_minerale = UTILISATION_MINERALES.get(type_barrage, 0)
    energie_non_renouvelable = UTILISATION_NON_RENOUVELABLES.get(type_barrage, 0)

    # Calcul des émissions de CO2
    emissions = facteur_charge * energie * facteur_emission  # en grammes de CO2
    emissions_tonnes = emissions / 1e6  # conversion en tonnes

    # Calcul de l'utilisation des ressources minérales (en tonnes)
    ressources_minerales_utilisation = (
        facteur_charge
        * energie
        * (
            UTILISATION_FIL_EAU
            if type_barrage == "Fil de l'eau"
            else UTILISATION_RESERVOIR
        )
    )

    # Calcul de l'extraction des ressources minérales (en kg Sb)
    ressources_minerales_extraction = (
        facteur_charge * energie * (EXTRACTION_MINERALE / 1e6)
    )

    # Calcul de l'utilisation des énergies minérales (en kg Sb)
    utilisation_energie_minerale = (
        facteur_charge * energie * (energie_minerale / 1e3)
    )  # conversion mg -> kg

    # Calcul de l'utilisation des énergies non renouvelables (en GJ)
    utilisation_energie_non_renouvelable = (
        facteur_charge * energie * (energie_non_renouvelable / 1e3)
    )  # conversion MJ -> GJ

    resultats.append(
        {
            "Barrage": barrage.donnees.nom,
            "Facteur de charge": round(facteur_charge, 3),
            "Émissions (tonnes CO2/an)": round(emissions_tonnes, 2),
            "Utilisation ressources minérales (tonnes/an)": round(
                ressources_minerales_utilisation, 6
            ),
            "Extraction ressources minérales (kg Sb/an)": round(
                ressources_minerales_extraction, 6
            ),
            "Utilisation des énergies minérales (kg Sb/an)": round(
                utilisation_energie_minerale, 6
            ),
            "Utilisation des énergies non renouvelables (GJ/an)": round(
                utilisation_energie_non_renouvelable, 6
            ),
        }
    )

    return pd.DataFrame(resultats)


def estimer_daly_futur(facteur_charge):
    """
    Estime le DALY futur en fonction du facteur de charge d'un nouveau barrage hydroélectrique.
    :param facteur_charge: Facteur de charge du nouveau barrage (valeur entre 0 et 1).
    :return: Estimation du DALY futur (DALY/kWh).
    """
    # Pourcentages de l'hydroélectricité dans chaque région
    mix_energie_hydro = {
        "Hydro-Québec": 97.6,
        "Vermont": 16.88,
        "Maine": 25.87,
        "New York": 18.16,
        "Connecticut": 0.86,
        "New Hampshire": 6.69,
        "Massachusetts": 2.52,
        "Rhode Island": 0.05,
    }

    # DALY total observé (extrait de la Figure 2)
    daly_total = {
        "Hydro-Québec": 1e-7,
        "Vermont": 5e-7,
        "Maine": 15e-7,
        "New York": 16e-7,
        "Connecticut": 16e-7,
        "New Hampshire": 17e-7,
        "Massachusetts": 24e-7,
        "Rhode Island": 27e-7,
    }

    # Transformation des données pour résoudre le système d'équations
    A = []
    B = []

    for region, mix in mix_energie_hydro.items():
        A.append([mix / 100])  # Conversion en proportion
        B.append(daly_total[region])

    # Conversion en matrices numpy
    A = np.array(A)
    B = np.array(B)

    # Résolution du système A * X = B pour trouver le DALY de l'hydroélectricité
    X = np.linalg.lstsq(A, B, rcond=None)[0]

    # Production actuelle et future (en % du mix énergétique du Québec)
    production_actuelle = mix_energie_hydro["Hydro-Québec"] / 100
    production_future = production_actuelle + facteur_charge * (1 - production_actuelle)

    # Estimation du DALY futur
    daly_futur = X[0] * production_future

    return daly_futur


# =============================================================================
# Nouvelle fonction : trajectoire de volumes sur toute la période de simulation
# =============================================================================

def get_reservoir_volumes_timeline(
    delta_t,
    start_date,
    end_date,
    power_required_mw=None,
    initial_levels=None,
):
    """
    Simule le volume (m³) de chaque barrage-réservoir à chaque pas de temps.

    La fonction itère de start_date à end_date par pas de delta_t et calcule,
    pour chaque réservoir, le bilan hydrique :

        V[t + Δt] = clamp(V[t] + apport[t] × Δt_s − décharge[t] × Δt_s,  0,  V_max)

    où :
        apport[t]  = débit naturel journalier (m³/s) × catch_coefficient  [pour le jour de t]
        décharge[t]= debits_nominal × nb_turbines_disponibles × fraction[t]  (m³/s)
        Δt_s       = delta_t en secondes
        V_max      = volume_reservoir  (m³, capacité totale du réservoir)

    La fraction de turbinage est déduite de power_required_mw : la puissance demandée
    est distribuée proportionnellement au niveau de remplissage courant de chaque réservoir
    (dispatch pondéré par le niveau). Cela évite de vider certains réservoirs pendant que
    d'autres restent pleins — les réservoirs les plus remplis turbinent davantage.
    Pour une simulation couplée au dispatch réel pas à pas, utiliser reservoir_infill()
    depuis reseau/utils/energy_utils.py.

    Paramètres
    ----------
    delta_t : timedelta ou pd.Timedelta ou str
        Durée d'un pas de temps. Exemples : timedelta(hours=1), "1H", "1D".
        Pour une simulation 2020–2035 horaire : delta_t=timedelta(hours=1) produit
        ~131 400 lignes (15 ans × 365 jours × 24 h).
    start_date : str, datetime ou pd.Timestamp
        Début de la période de simulation (inclus).
    end_date : str, datetime ou pd.Timestamp
        Fin de la période de simulation (inclus si multiple entier de delta_t).
    power_required_mw : float, array-like ou None, optionnel
        Puissance totale (MW) que les réservoirs doivent fournir à chaque pas de temps.
        - None           → décharge par défaut à 50 % du débit nominal (trajectoire neutre)
        - float scalaire → puissance constante sur toute la période
        - array-like     → puissance variable, longueur doit correspondre au nombre de
                           pas de temps (len(timestamps))
        La puissance est distribuée proportionnellement au niveau de remplissage courant
        de chaque réservoir pondéré par sa puissance nominale disponible :
            poids[i] = (V_courant[i] / V_max[i]) × P_max[i]
        Un réservoir plein à 80 % contribue plus qu'un réservoir à 20 % de même capacité.
        Si power_required_mw dépasse la capacité maximale combinée, le débit est plafonné
        au débit de conception maximal.
    initial_levels : dict, optionnel
        Niveau initial de chaque réservoir {nom_barrage: fraction [0, 1]}.
        Les barrages absents utilisent la valeur par défaut de 0.7 (70 % plein).

    Retourne
    --------
    pd.DataFrame
        - Index  : pd.DatetimeIndex de start_date à end_date, pas = delta_t
        - Colonnes : nom (str) de chaque barrage-réservoir présent dans la DB
        - Valeurs  : volume en m³ [0, volume_reservoir]

    Utilisation depuis le module reseau
    ------------------------------------
    from harmoniq.modules.hydro.calcule import get_reservoir_volumes_timeline
    from datetime import timedelta

    # Puissance constante requise de 2000 MW sur toute la période :
    volumes = get_reservoir_volumes_timeline(
        delta_t=timedelta(hours=1),
        start_date=scenario.date_de_debut,
        end_date=scenario.date_de_fin,
        power_required_mw=2000.0,
    )
    # volumes["NomDuBarrage"] est une Series avec le volume (m³) heure par heure.
    # Pour convertir en fraction [0, 1], diviser par volume_reservoir du barrage.

    Notes
    -----
    - Les données d'apport naturel (apport_naturel/*.csv) ont une résolution journalière.
      Pour un pas de temps inférieur à un jour, la valeur quotidienne est répétée
      à chaque pas de temps de la même journée (bilan journalier constant).
    - Si le fichier CSV d'apport d'un barrage n'existe pas ou ne couvre pas la période,
      l'apport est supposé nul pour les pas de temps manquants.
    - Le coefficient d'apport (catch_coeff_map) est appliqué à l'apport naturel.
    - La complexité est O(N × M) où N = nombre de pas de temps et M = nombre de
      réservoirs. Pour 15 ans à 1 h, N ≈ 131 400 ; l'exécution prend quelques secondes.
    - Les barrages "Fil de l'eau" sont ignorés (seuls les "Reservoir" ont un volume utile).
    """
    db = next(get_db())
    barrages = read_all_hydro(db)
    reservoir_dams = [b for b in barrages if b.type_barrage == "Reservoir"]

    if not reservoir_dams:
        return pd.DataFrame()

    # --- Normalisation des types d'entrée ---
    delta_t    = pd.Timedelta(delta_t)
    start_date = pd.Timestamp(start_date)
    end_date   = pd.Timestamp(end_date)
    dt_seconds = delta_t.total_seconds()

    if initial_levels is None:
        initial_levels = {}

    timestamps = pd.date_range(start=start_date, end=end_date, freq=delta_t)
    n_steps    = len(timestamps)
    n_dams     = len(reservoir_dams)
    dates_jour = timestamps.normalize()

    # --- Constantes par barrage (numpy arrays, shape = n_dams) ---
    def _max_power_mw(dam) -> float:
        nb_dispo = dam.nb_turbines - dam.nb_turbines_maintenance
        return float(dam.puissance_nominal) * nb_dispo / max(dam.nb_turbines, 1)

    names         = [d.nom for d in reservoir_dams]
    volumes_max   = np.array([float(d.volume_reservoir) for d in reservoir_dams])
    max_power_mw  = np.array([_max_power_mw(d) for d in reservoir_dams])
    # Débit maximal (m³/s) = débit nominal × turbines disponibles
    max_flow_m3s  = np.array([
        float(d.debits_nominal) * (d.nb_turbines - d.nb_turbines_maintenance)
        for d in reservoir_dams
    ])

    # --- Chargement de tous les apports en une passe (shape = n_dams × n_steps) ---
    all_inflows = np.zeros((n_dams, n_steps))
    for i, dam in enumerate(reservoir_dams):
        apport_path = APPORT_DIR / (str(dam.id_HQ) + ".csv")
        if apport_path.exists():
            apport = pd.read_csv(apport_path)
            apport["time"] = pd.to_datetime(apport["time"])
            apport = apport.set_index("time")["streamflow"] * catch_coeff_map.get(dam.nom, 1.0)
            aligned = apport.reindex(dates_jour).ffill().fillna(0.0)
            all_inflows[i] = np.nan_to_num(aligned.values, nan=0.0) * dt_seconds  # m³/pas

    # --- Vecteur de puissance demandée (MW, shape = n_steps) ---
    if power_required_mw is None:
        req_array = None                          # décharge neutre à 50 %
    else:
        req_array = np.asarray(power_required_mw, dtype=float)
        if req_array.ndim == 0:
            req_array = np.full(n_steps, float(req_array))
        if len(req_array) != n_steps:
            raise ValueError(
                f"power_required_mw a {len(req_array)} valeurs mais la période contient "
                f"{n_steps} pas de temps."
            )

    # --- Simulation pas à pas (boucle sur le temps) ---
    # La boucle doit être temporelle (pas par barrage) car la fraction de décharge
    # dépend du niveau courant de chaque réservoir à l'instant t.
    volumes_current = np.array([
        initial_levels.get(d.nom, 0.7) * float(d.volume_reservoir)
        for d in reservoir_dams
    ])
    volumes_result = np.empty((n_steps, n_dams))

    for t in range(n_steps):
        inflows_t = all_inflows[:, t]           # m³ apportés à ce pas de temps

        if req_array is None:
            # Trajectoire neutre : 50 % du débit maximal de chaque réservoir
            discharges_t = max_flow_m3s * 0.5 * dt_seconds
        else:
            # Dispatch pondéré par le niveau : réservoirs plus pleins turbinent plus.
            # poids[i] = (V_courant[i] / V_max[i]) × P_max[i]
            # Cela équilibre naturellement les niveaux entre réservoirs.
            fill_frac = volumes_current / volumes_max          # ∈ [0, 1]
            weights   = fill_frac * max_power_mw               # MW pondérés
            total_w   = weights.sum()

            if total_w > 0:
                # Part de puissance allouée à chaque barrage
                dam_powers = req_array[t] * weights / total_w  # MW
            else:
                # Tous les réservoirs vides : aucune production possible
                dam_powers = np.zeros(n_dams)

            # Fraction de décharge ∈ [0, 1] : puissance_allouée / puissance_max
            flow_fracs    = np.where(max_power_mw > 0,
                                     np.clip(dam_powers / max_power_mw, 0.0, 1.0),
                                     0.0)
            discharges_t  = max_flow_m3s * flow_fracs * dt_seconds  # m³

        # Bilan hydrique + clamp physique [0, V_max]
        volumes_current = np.clip(
            volumes_current + inflows_t - discharges_t,
            0.0,
            volumes_max,
        )
        volumes_result[t] = volumes_current

    return pd.DataFrame(volumes_result, index=timestamps, columns=names)


if __name__ == "__main__":
    import asyncio
    from datetime import timedelta
    from harmoniq.db.demande import read_demande_data_temporal
    from harmoniq.db.schemas import Weather, Consomation

    DT         = timedelta(hours=1)
    START      = "2035-01-01"
    END_SHORT  = "2035-01-07"   # une semaine — rapide
    END_FULL   = "2035-12-31"   # année complète

    # Objet scénario minimal attendu par read_demande_data_temporal
    class _Scenario:
        weather      = Weather.typical   # météo typique
        consomation  = Consomation.PV    # consommation normale
        date_de_debut = START
        date_de_fin   = END_FULL         # charge tout 2035

    # --- Chargement de la demande réelle depuis la base SQLite ---
    print("Chargement de la demande depuis demande.db …")
    df_demande = asyncio.run(read_demande_data_temporal(_Scenario()))
    # df_demande : index DatetimeIndex horaire, colonne "total_electricity" en kW

    print(f"  Période DB : {df_demande.index.min()}  →  {df_demande.index.max()}")
    print(f"  Pointe     : {df_demande['total_electricity'].max() / 1000:.0f} MW")
    print(f"  Moyenne    : {df_demande['total_electricity'].mean() / 1000:.0f} MW")

    # --- Cas 1 : une semaine, décharge par défaut (50 %) ---
    print("\n=== Cas 1 : décharge par défaut (50 % débit nominal) — 1 semaine ===")
    volumes_default = get_reservoir_volumes_timeline(
        delta_t=DT,
        start_date=START,
        end_date=END_SHORT,
    )
    print(volumes_default.describe().loc[["min", "max"]])

    # --- Cas 2 : une semaine, puissance constante 2 000 MW ---
    print("\n=== Cas 2 : puissance constante 2 000 MW — 1 semaine ===")
    volumes_2000 = get_reservoir_volumes_timeline(
        delta_t=DT,
        start_date=START,
        end_date=END_SHORT,
        power_required_mw=2000.0,
    )
    print(volumes_2000.describe().loc[["min", "max"]])

    # --- Cas 3 : demande réelle issue de la DB (année complète 2035) ---
    print("\n=== Cas 3 : demande réelle DB 2035 (année complète) ===")

    # Alignement de la demande sur l'axe temporel de la simulation
    timestamps_full = pd.date_range(start=START, end=END_FULL, freq=DT)
    demande_mw = (
        (df_demande["total_electricity"] / 1000)        # kW → MW
        .reindex(timestamps_full)
        .ffill()
        .bfill()
        .fillna(0.0)
    )
    print(f"  Pas de temps : {len(demande_mw)}")

    volumes_reel = get_reservoir_volumes_timeline(
        delta_t=DT,
        start_date=START,
        end_date=END_FULL,
        power_required_mw=demande_mw.values,
    )
    print(volumes_reel.describe().loc[["min", "max"]])

    # Niveau de remplissage moyen en fin d'année (fraction [0, 1])
    db_tmp = next(get_db())
    barrages_tmp = read_all_hydro(db_tmp)
    vmax = {b.nom: float(b.volume_reservoir) for b in barrages_tmp if b.type_barrage == "Reservoir"}
    niveaux_fin = {nom: volumes_reel[nom].iloc[-1] / vmax[nom] for nom in volumes_reel.columns if nom in vmax}
    print("\nNiveau de remplissage en fin d'année :")
    for nom, lvl in sorted(niveaux_fin.items(), key=lambda x: x[1]):
        print(f"  {nom:<30} {lvl:.1%}")
