import pvlib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import time
from harmoniq.modules.solaire.data_solaire import (
    coordinates_centrales,
    coordinates_residential,
    population_relative,
)
from typing import List


def get_weather_data(coordinates, year=2021):
    tmys = []
    for location in coordinates:
        latitude, longitude, name, altitude, timezone, power_kw = location
        print(f"\nRécupération des données météo horaires pour {name} en {year}...")
        try:
            weather, _, _ = pvlib.iotools.get_pvgis_hourly(
                latitude, longitude, start=year, end=year
            )
            weather.index.name = "utc_time"
            tmys.append((weather, location))
        except Exception as e:
            print(f"Erreur pour {name}: {e}")
            tmys.append((None, location))
    return tmys


def calculate_solar_parameters(
    weather,
    latitude,
    longitude,
    altitude,
    temperature_model_parameters,
    module,
    inverter,
    surface_tilt,
    surface_orientation,
):
    solpos = pvlib.solarposition.get_solarposition(
        time=weather.index,
        latitude=latitude,
        longitude=longitude,
        altitude=altitude,
        temperature=weather["temp_air"],
        pressure=pvlib.atmosphere.alt2pres(altitude),
    )
    dni_extra = pvlib.irradiance.get_extra_radiation(weather.index)
    airmass = pvlib.atmosphere.get_relative_airmass(solpos["apparent_zenith"])
    pressure = pvlib.atmosphere.alt2pres(altitude)
    am_abs = pvlib.atmosphere.get_absolute_airmass(airmass, pressure)
    aoi = pvlib.irradiance.aoi(
        surface_tilt,
        surface_orientation,
        solpos["apparent_zenith"],
        solpos["azimuth"],
    )
    total_irradiance = pvlib.irradiance.get_total_irradiance(
        surface_tilt,
        surface_orientation,
        solpos["apparent_zenith"],
        solpos["azimuth"],
        weather["dni"],
        weather["ghi"],
        weather["dhi"],
        dni_extra=dni_extra,
        model="haydavies",
    )
    cell_temperature = pvlib.temperature.sapm_cell(
        total_irradiance["poa_global"],
        weather["temp_air"],
        weather["wind_speed"],
        **temperature_model_parameters,
    )
    effective_irradiance = pvlib.pvsystem.sapm_effective_irradiance(
        total_irradiance["poa_direct"],
        total_irradiance["poa_diffuse"],
        am_abs,
        aoi,
        module,
    )
    dc = pvlib.pvsystem.sapm(effective_irradiance, cell_temperature, module)
    ac = pvlib.inverter.sandia(dc["v_mp"], dc["p_mp"], inverter)
    return ac

# Conversion entre surface de panneaux et puissance produite - non utilisé pour la version en ModelChain, mais peut être utile pour des calculs rapides ou des estimations approximatives.
def convert_solar(value, module, mode="surface_to_power"):
    panel_efficiency = module["Impo"] * module["Vmpo"] / (1000 * module["Area"])

    if mode == "surface_to_power":
        power_w = value * panel_efficiency * 1000
        power_kw = power_w / 1000
        return power_kw
    elif mode == "power_to_surface":
        surface_m2 = value * 1000 / (panel_efficiency * 1000)
        return surface_m2
    else:
        raise ValueError(
            "Mode invalide. Utilisez 'surface_to_power' ou 'power_to_surface'."
        )

nom = "varennes"
latitude = 45.6833
longitude = -73.4333
angle_panneau = 45
orientation_panneau = 180
puissance_nominal = 9.5 # mauvaise valeur
nombre_panneau = 10000 # mauvaise valeur
date_start = pd.Timestamp("2035-01-01")
date_end = pd.Timestamp("2037-06-01")

# Scénarios résidentiels : nombre de panneaux par client
PANELS_PAR_SCENARIO = {"pessimiste": 2, "neutre": 4, "optimiste": 6}


def calculate_energy_solar_plants(
    nom: str,
    latitude: float,
    longitude: float,
    angle_panneau: float,
    orientation_panneau: float,
    puissance_nominal: float,
    nombre_panneau: int,
    date_start: pd.Timestamp,
    date_end: pd.Timestamp,
    albedo_saisonnier: bool = True,
    bifacial: bool = True,
    bifaciality_factor: float = 0.70,
    gcr: float = 0.40,
    hauteur_montage: float = 1.0,
    espacement_rangees: float = 5.0,
) -> pd.DataFrame:
    """
    Calcule un profil horaire d'énergie produite par une centrale solaire via pvlib ModelChain.

    Arguments obligatoires :
        - nom : nom de la centrale
        - latitude, longitude : position géographique
        - angle_panneau : inclinaison des panneaux [degrés]
        - orientation_panneau : azimut des panneaux [degrés, 180=sud]
        - puissance_nominal : puissance crête par panneau [kW]
        - nombre_panneau : nombre total de panneaux
        - date_start, date_end : période horaire demandée

    Arguments optionnels :
        - albedo_saisonnier  : True = neige hiver (0.60) / herbe été (0.20)
                               False = valeur fixe (0.25)
        - bifacial           : True = active le modèle bifacial (infinite_sheds)
        - bifaciality_factor : ratio efficacité arrière/avant du module (défaut 0.70)
        - gcr                : ground coverage ratio, ratio longueur_panneau/espacement [0-1]
        - hauteur_montage    : hauteur du centre de la rangée au-dessus du sol [m]
        - espacement_rangees : distance entre rangées [m]

    Retour :
        - DataFrame avec colonnes : date, nom, Latitude, Longitude, production [kW]
    """
    # --- Modèles de référence (Sandia) ---
    sandia_modules = pvlib.pvsystem.retrieve_sam("SandiaMod")
    sapm_inverters = pvlib.pvsystem.retrieve_sam("cecinverter")
    module = sandia_modules["Canadian_Solar_CS5P_220M___2009_"]
    inverter = sapm_inverters["ABB__MICRO_0_25_I_OUTD_US_208__208V_"]
    temp_params = pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS["sapm"]["open_rack_glass_glass"]

    # --- Location et système PV ---
    location = pvlib.location.Location(
        latitude=latitude,
        longitude=longitude,
        tz="Etc/GMT+5",
        altitude=0,
    )
    system = pvlib.pvsystem.PVSystem(
        surface_tilt=angle_panneau,
        surface_azimuth=orientation_panneau,
        module_parameters=module,
        inverter_parameters=inverter,
        temperature_model_parameters=temp_params,
    )
    mc = pvlib.modelchain.ModelChain(system, location)

    # --- Données météo TMY depuis PVGIS (année typique, 8760h) ---
    weather, _ = pvlib.iotools.get_pvgis_tmy(
        latitude, longitude, map_variables=True
    )
    
    # --- Albédo saisonnier (Québec) ---
    # pvlib 0.10+ lit l'albédo depuis une colonne 'albedo' du weather DataFrame.
    # Méthode: weather['albedo'] = Series saisonnière (prioritaire sur system.albedo).
    weather = weather.copy()
    if albedo_saisonnier:
        mois = weather.index.month
        albedo = pd.Series(0.20, index=weather.index)   # été  : herbe/asphalte
        albedo[mois.isin([4, 10, 11])] = 0.25           # transition
        albedo[mois.isin([12, 1, 2, 3])] = 0.60         # hiver : neige
        weather["albedo"] = albedo
    else:
        weather["albedo"] = 0.25                        # défaut pvlib

    # --- Simulation sur l'année typique ---
    mc.run_model(weather)
    ac_tmy_w = np.maximum(mc.results.ac.values, 0)  # W pour 1 module, 8760 h

    # --- Modèle bifacial (infinite_sheds) ---
    if bifacial:
        from pvlib.bifacial.infinite_sheds import get_irradiance as _bifacial_irrad
        solpos = location.get_solarposition(weather.index)
        rear = _bifacial_irrad(
            surface_tilt=angle_panneau,
            surface_azimuth=orientation_panneau,
            solar_zenith=solpos["apparent_zenith"],
            solar_azimuth=solpos["azimuth"],
            gcr=gcr,
            height=hauteur_montage,
            pitch=espacement_rangees,
            ghi=weather["ghi"],
            dhi=weather["dhi"],
            dni=weather["dni"],
            albedo=weather["albedo"],
            bifaciality=bifaciality_factor,
        )
        # Irradiance effective totale = face avant + face arrière × bifaciality
        total_eff = mc.results.effective_irradiance + rear["poa_back"] * bifaciality_factor
        dc_bi = pvlib.pvsystem.sapm(total_eff, mc.results.cell_temperature, module)
        ac_bi = pvlib.inverter.sandia(dc_bi["v_mp"], dc_bi["p_mp"], inverter)
        ac_tmy_w = np.maximum(ac_bi.values, 0)

    # PVGIS retourne des données en UTC; l'heure locale Québec est UTC-5.
    # On roll de -5 pour que le profil soit aligné sur l'heure locale.
    ac_tmy_w = np.roll(ac_tmy_w, -5)

    # --- Mise à l'échelle vers la puissance totale de la centrale ---
    puissance_module_w = module["Impo"] * module["Vmpo"]          # ~221 W
    puissance_totale_w = puissance_nominal * 1_000 * nombre_panneau  # kW → W
    scaling_factor = puissance_totale_w / puissance_module_w

    # --- Répétition du profil TMY sur la période voulue ---
    datetime_index = pd.date_range(start=date_start, end=date_end, freq="h")
    n_repeats = int(np.ceil(len(datetime_index) / len(ac_tmy_w)))
    ac_tiled = np.tile(ac_tmy_w, n_repeats)[: len(datetime_index)]
    production_kw = ac_tiled * scaling_factor / 1_000  # W → kW

    return pd.DataFrame(
        {
            "date": datetime_index,
            "nom": nom,
            "Latitude": latitude,
            "Longitude": longitude,
            "production": production_kw,
        }
    )
# Version précédente (sans ModelChain, moins précise) --- IGNORE ---
def calculate_energy_solar_plants_old( 
    nom : str,
    latitude: float,
    longitude: float,
    angle_panneau: float,
    orientation_panneau: float,
    puissance_nominal: float,
    nombre_panneau: int,
    date_start: pd.Timestamp,
    date_end: pd.Timestamp,
) -> pd.DataFrame:
    """
    Calcule la production énergétique des centrales solaires.
    Returns
    -------
    pd.DataFrame
        DataFrame contenant la production énergétique horaire.
    """

    # Initialisation des modèles
    sandia_modules = pvlib.pvsystem.retrieve_sam("SandiaMod")
    sapm_inverters = pvlib.pvsystem.retrieve_sam("cecinverter")

    module = sandia_modules["Canadian_Solar_CS5P_220M___2009_"]
    inverter = sapm_inverters["ABB__MICRO_0_25_I_OUTD_US_208__208V_"]
    temperature_model_parameters = pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS[
        "sapm"
    ]["open_rack_glass_glass"]

    # Récupération des données météo
    weather = pvlib.iotools.get_pvgis_tmy(latitude, longitude)[0]
    weather.index.name = "utc_time"

    # Calcul du nombre de modules nécessaires
    puissance_module_w = module["Impo"] * module["Vmpo"]
    print(puissance_module_w)
    nombre_modules = int(np.ceil((puissance_nominal * 1e6) / puissance_module_w))
    altitude = 0  # Valeur par défaut pour l'altitude

    # Calcul de la production
    print(f"Calcul de la production pour {nom}")
    ac = calculate_solar_parameters(
        weather,
        latitude,
        longitude,
        altitude,
        temperature_model_parameters,
        module,
        inverter,
        angle_panneau,
        orientation_panneau,
        )
    # Mise à l'échelle selon la puissance de la centrale
    ac_scaled = ac * nombre_modules

    # Fixer les valeurs négatives à zéro
    ac_scaled = np.maximum(ac_scaled, 0)

    # Création de la plage de dates pour remplacer les datetime
    datetime_index = pd.date_range(start=date_start, end=date_end, freq="h")

    # Gestion des cas où la longueur de datetime_index dépasse celle de ac
    if len(ac) < len(datetime_index):

        # Dupliquer les données de ac pour remplir les heures supplémentaires
        ac_extended = np.tile(ac, int(np.ceil(len(datetime_index) / len(ac))))[:len(datetime_index)]

        # Clip les valeurs pour les heures supplémentaires
        for i in range(len(ac), len(datetime_index)):
            year_offset = (datetime_index[i].year - datetime_index[0].year)
            ac_extended[i] = np.clip(ac_extended[i % len(ac)], 0, ac_extended[i % len(ac)] * year_offset)

        # Fixer les valeurs négatives à zéro
        ac_extended = np.maximum(ac_extended, 0)
    else:
        # Si datetime_index est inférieur ou égal à ac, tronquer ac
        ac_extended = ac[:len(datetime_index)]
        ac_extended = np.maximum(ac_extended, 0)


    # Création du DataFrame avec la production horaire
    resultats_centrales_df = pd.DataFrame(
        {
            "datetime": datetime_index,  # Utiliser la plage horaire générée
            "production_horaire_wh": ac_extended,
        }
    )
    resultats_centrales_df.set_index("datetime", inplace=True)
    return resultats_centrales_df
    

def calculate_regional_residential_solar(
    coordinates_residential: List[tuple],
    population_relative: dict,
    total_clients: int,
    surface_tilt: float,
    surface_orientation: float,
    date_start: pd.Timestamp,
    date_end: pd.Timestamp,
    scenario: str = "neutre",
) -> tuple:
    """
    Estime la production horaire solaire résidentielle pour plusieurs régions.

    Arguments :
        coordinates_residential : liste de tuples (lat, lon, nom_region, altitude, timezone)
        population_relative     : dict {nom_region: part relative de population (0-1)}
        total_clients           : nombre total de clients résidentiels
        surface_tilt            : inclinaison des panneaux [degrés]
        surface_orientation     : azimut des panneaux [degrés, 180=sud]
        date_start, date_end    : période horaire
        scenario                : "pessimiste" (2 pan./client) | "neutre" (4) | "optimiste" (6)

    Retour :
        production_df : profil horaire — colonnes : date, nom, Latitude, Longitude,
                        puissance_installee_kw, production [kW]
        summary_df    : une ligne par région — colonnes : nom_region, latitude, longitude,
                        puissance_installee_kw, surface_installee_m2, energie_annuelle_kwh
    """
    if scenario not in PANELS_PAR_SCENARIO:
        raise ValueError(f"scenario doit être l'un de {list(PANELS_PAR_SCENARIO)}")

    num_panels_per_client = PANELS_PAR_SCENARIO[scenario]

    # Puissance et surface dérivées du module Sandia de référence
    sandia_modules = pvlib.pvsystem.retrieve_sam("SandiaMod")
    module_ref = sandia_modules["Canadian_Solar_CS5P_220M___2009_"]
    puissance_panneau_kw = module_ref["Impo"] * module_ref["Vmpo"] / 1000  # ~0.221 kW
    surface_par_panneau_m2 = module_ref["Area"]

    production_list = []
    summary_list = []

    for (latitude, longitude, nom_region, altitude, timezone) in coordinates_residential:
        pop_weight = population_relative.get(nom_region, 0)
        nb_panneaux = int(total_clients * pop_weight * num_panels_per_client)
        puissance_installee_kw = nb_panneaux * puissance_panneau_kw
        surface_installee_m2 = nb_panneaux * surface_par_panneau_m2

        df = calculate_energy_solar_plants(
            nom=nom_region,
            latitude=latitude,
            longitude=longitude,
            angle_panneau=surface_tilt,
            orientation_panneau=surface_orientation,
            puissance_nominal=puissance_panneau_kw,
            nombre_panneau=nb_panneaux,
            date_start=date_start,
            date_end=date_end,
        )
        df["puissance_installee_kw"] = puissance_installee_kw
        production_list.append(df)

        summary_list.append({
            "nom_region": nom_region,
            "latitude": latitude,
            "longitude": longitude,
            "puissance_installee_kw": puissance_installee_kw,
            "surface_installee_m2": surface_installee_m2,
            "energie_annuelle_kwh": df["production"].sum(),
        })

    production_df = pd.concat(production_list, ignore_index=True)
    summary_df = pd.DataFrame(summary_list)

    return production_df, summary_df


def precalculate_residential_scenarios(
    coordinates_residential: List[tuple],
    population_relative: dict,
    total_clients: int,
    surface_tilt: float,
    surface_orientation: float,
    date_start: pd.Timestamp,
    date_end: pd.Timestamp,
) -> dict:
    """
    Pré-calcule les 3 scénarios résidentiels d'un coup (pessimiste/neutre/optimiste).

    Retour :
        dict {
            "pessimiste": (production_df, summary_df),
            "neutre":   (production_df, summary_df),
            "optimiste":  (production_df, summary_df),
        }
    """
    return {
        s: calculate_regional_residential_solar(
            coordinates_residential=coordinates_residential,
            population_relative=population_relative,
            total_clients=total_clients,
            surface_tilt=surface_tilt,
            surface_orientation=surface_orientation,
            date_start=date_start,
            date_end=date_end,
            scenario=s,
        )
        for s in PANELS_PAR_SCENARIO
    }


def cost_solar_powerplant(puissance_mw):
    """
    Calcule le coût total pour chaque centrale solaire.

    Parameters
    ----------
    coordinates_centrales : list of tuples
        Liste des coordonnées et puissances des centrales
    resultats_centrales : dict
        Dictionnaire contenant l'énergie produite par chaque centrale

    Returns
    -------
    dict
        Dictionnaire contenant le coût total en dollars pour chaque centrale
    """
    couts = {}
    # Coût de référence par MW pour le Québec
    cout_par_mw = 4_210_000  # Estimation moyenne des coûts actuels

    # Coût total prenant en compte les coûts indirects et opérationnels
    cout_total = puissance_mw * cout_par_mw

    couts[nom] = cout_total

    return couts


def calculate_installation_cost(puissance_mw):
    """
    Returns
    -------
    dict
        Dictionnaire contenant le coût d'installation pour chaque centrale
    """
    couts_installation = {}
    # Coûts de base par MW selon la taille de l'installation
    if puissance_mw < 1:
        cout_base = 4_500_000  # Plus cher pour petites installations
    elif 1 <= puissance_mw < 5:
            cout_base = 4_210_000  # Coût moyen
    else:
        cout_base = 3_900_000  # Économies d'échelle pour grandes installations

    # Facteurs d'ajustement
    facteur_echelle = 0.85  # Économies d'échelle
    facteur_complexite = 1.1  # Complexité du site et infrastructure

    # Calcul du coût d'installation avec facteurs
    cout_installation = (
        cout_base * (puissance_mw**facteur_echelle) * facteur_complexite
        )
    couts_installation[nom] = cout_installation

    return couts_installation


def calculate_lifetime(puissance_mw):
    """
    Estime la durée de vie des centrales solaires en fonction de leurs puissances installées.

    Parameters
    ----------
    coordinates_centrales : list of tuples
        Liste des coordonnées et puissances des centrales sous forme de tuples
        (latitude, longitude, nom, altitude, timezone, puissance_kw)

    Returns
    -------
    dict
        Dictionnaire contenant la durée de vie estimée pour chaque centrale
    """
    durees_vie = {}


    if puissance_mw < 1:
        duree_vie = 25  # Petites installations
    elif 1 <= puissance_mw < 10:
        duree_vie = 30  # Installations moyennes
    else:
        duree_vie = 35  # Grandes installations

    durees_vie[nom] = duree_vie

    return durees_vie


def co2_emissions_solar(
    coordinates_centrales, resultats_centrales, facteur_emission=40
):
    """
    Calcule les émissions totales de CO₂ équivalent pour chaque centrale solaire sur toute sa durée de vie.

    Parameters
    ----------
    coordinates_centrales : list of tuples
        Liste des coordonnées et puissances des centrales
    resultats_centrales : dict
        Dictionnaire contenant l'énergie produite par chaque centrale
    facteur_emission : float, optional
        Facteur d'émission en g CO₂eq/kWh basé sur l'ACV

    Returns
    -------
    dict
        Dictionnaire contenant les émissions totales de CO₂ en kg pour chaque centrale
    """
    emissions = {}
    durees_vie = calculate_lifetime(coordinates_centrales)

    for centrale in coordinates_centrales:
        nom = centrale[2]
        energie_kwh = resultats_centrales[nom]["energie_annuelle_wh"] / 1000
        duree_vie = durees_vie[nom]

        # Calcul des émissions sur toute la durée de vie
        emissions_g = energie_kwh * facteur_emission * duree_vie
        emissions[nom] = emissions_g / 1000

    return emissions


# Exemple d'utilisation
if __name__ == "__main__":

    DATE_START = pd.Timestamp("2035-01-01")
    DATE_END   = pd.Timestamp("2035-12-31 23:00:00")
    MOIS_LABELS = ["Jan","Fev","Mar","Avr","Mai","Jun",
                   "Jul","Aou","Sep","Oct","Nov","Dec"]

    # --- Calcul des deux centrales ---
    resultats = []
    for lat, lon, nom_c, alt, tz, puissance_kw in coordinates_centrales:
        print(f">> Calcul de {nom_c} (appel PVGIS)...")
        df = calculate_energy_solar_plants(
            nom=nom_c,
            latitude=lat,
            longitude=lon,
            angle_panneau=30.0,
            orientation_panneau=180.0,
            puissance_nominal=0.22,        # kW par panneau (module Sandia ~220 W)
            nombre_panneau=int(puissance_kw / 0.22),  # nombre de panneaux pour atteindre puissance_kw
            date_start=DATE_START,
            date_end=DATE_END,
        )
        total_gwh = df["production"].sum() / 1_000_000
        print(f"   Lignes          : {len(df)}")
        print(f"   Production ann. : {total_gwh:.3f} GWh")
        print(f"   Pic max         : {df['production'].max():,.0f} kW")
        print(df.head(6).to_string(index=False))
        resultats.append(df)

    tous = pd.concat(resultats, ignore_index=True)

    # --- Graphique 1 : production horaire — semaine de juillet ---
    fig, axes = plt.subplots(len(resultats), 1, figsize=(14, 5 * len(resultats)))
    if len(resultats) == 1:
        axes = [axes]

    for ax, df in zip(axes, resultats):
        juillet = df[pd.to_datetime(df["date"]).dt.month == 7].head(24 * 7)
        ax.fill_between(pd.to_datetime(juillet["date"]), juillet["production"], alpha=0.75)
        ax.set_title(f"{df['nom'].iloc[0]} — Production horaire (1re semaine de juillet 2035)")
        ax.set_ylabel("Production (kW)")
        ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("production_juillet.png", dpi=120)
    print("\n[OK] production_juillet.png sauvegarde")

    # --- Graphique 2 : production mensuelle (barres) ---
    fig2, ax2 = plt.subplots(figsize=(12, 5))
    x = np.arange(12)
    width = 0.35

    for i, df in enumerate(resultats):
        df2 = df.copy()
        df2["mois"] = pd.to_datetime(df2["date"]).dt.month
        mensuel = df2.groupby("mois")["production"].sum() / 1_000  # MWh
        ax2.bar(x + i * width, mensuel.values, width, label=df["nom"].iloc[0], alpha=0.85)

    ax2.set_xticks(x + width / 2)
    ax2.set_xticklabels(MOIS_LABELS)
    ax2.set_ylabel("Production mensuelle (MWh)")
    ax2.set_title("Production mensuelle par centrale — 2035")
    ax2.legend()
    ax2.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig("production_mensuelle.png", dpi=120)
    print("[OK] production_mensuelle.png sauvegarde")

    # --- Graphique 3 : heatmap heure x mois (toutes centrales cumulées) ---
    tous["mois"] = pd.to_datetime(tous["date"]).dt.month
    tous["heure"] = pd.to_datetime(tous["date"]).dt.hour
    heatmap_data = tous.pivot_table(
        values="production", index="heure", columns="mois", aggfunc="mean"
    )
    heatmap_data.columns = MOIS_LABELS
    heatmap_data = heatmap_data.replace(0, np.nan)

    fig3, ax3 = plt.subplots(figsize=(12, 7))
    im = ax3.imshow(heatmap_data.values, aspect="auto", cmap="YlOrRd", origin="lower")
    fig3.colorbar(im, ax=ax3, label="Production moyenne (kW)")
    ax3.set_xticks(range(12))
    ax3.set_xticklabels(MOIS_LABELS, rotation=45)
    ax3.set_yticks(range(24))
    ax3.set_yticklabels(range(24))
    ax3.set_xlabel("Mois")
    ax3.set_ylabel("Heure de la journee")
    ax3.set_title("Heatmap production solaire moyenne — toutes centrales (kW)")
    plt.tight_layout()
    plt.savefig("production_heatmap.png", dpi=120)
    print("[OK] production_heatmap.png sauvegarde")

    plt.show()
