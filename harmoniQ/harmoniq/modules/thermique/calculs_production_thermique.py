import pandas as pd
from datetime import datetime, timedelta
import logging
logger = logging.getLogger("Thermique.Calculs")

#Constantes de la saison de maintenance (Hardcodées pour l'instant, communes gaz + charbon)
MAINTENANCE_SEASON_START = 18   # début mai
MAINTENANCE_SEASON_END = 34     # fin août
#Profil par défaut proposés à l'utilisateur
PROFILS_THERMIQUE = {
    "Gaz naturel": {
        "name": "Centrale Gaz Naturel",
        "power_mw": 411,        # Référence : Bécancour
        "fuel_type": "Gaz naturel",
    },
    "Charbon": {
        "name": "Centrale Charbon",
        "power_mw": 600,        # Référence : TBD
        "fuel_type": "Charbon",
    },
    "Diesel": {
        "name": "Centrale Diesel",
        "power_mw": 150,        # Référence : TBD
        "fuel_type": "Diesel",
    },
    "Biomasse": {
        "name": "Centrale Biomasse",
        "power_mw": 50,         # Référence : TBD
        "fuel_type": "Biomasse",
    },
}

def _get_maintenance_bounds(year: int, week: int) -> tuple[datetime, datetime]:
    """Retourne (début, fin) de la semaine ISO `week` pour l'année `year`."""
    jan4 = datetime(year, 1, 4)
    week1_monday = jan4 - timedelta(days=jan4.weekday())
    start = week1_monday + timedelta(weeks=week - 1)
    return start, start + timedelta(weeks=1)

def assign_maintenance_weeks(n_centrales: int) -> list[int]:
    """
    Répartit n_centrales semaines de maintenance dans la saison définie
    par MAINTENANCE_SEASON_START et MAINTENANCE_SEASON_END.

    Si n_centrales dépasse l'amplitude de la saison, plusieurs centrales
    partagent la même semaine (chevauchement circulaire).

    Formule sans chevauchement : w_i = S_start + floor(i * amplitude / n)
    Formule avec chevauchement  : w_i = S_start + (i mod amplitude)

    Returns
    -------
    list[int]
        Liste de n semaines ISO, une par centrale.
    """
    amplitude = MAINTENANCE_SEASON_END - MAINTENANCE_SEASON_START

    if n_centrales <= amplitude:
        # Répartition uniforme — aucun chevauchement
        return [
            MAINTENANCE_SEASON_START + int(i * amplitude / n_centrales)
            for i in range(n_centrales)
        ]
    else:
        # Plus de centrales que de semaines — chevauchement circulaire
        nb_chevauchements = n_centrales // amplitude
        logger.warning(
            f"{n_centrales} centrales pour {amplitude} semaines disponibles "
            f"(S{MAINTENANCE_SEASON_START}→S{MAINTENANCE_SEASON_END}) — "
            f"jusqu'à {nb_chevauchements + 1} centrales partageront la même semaine."
        )
        return [
            MAINTENANCE_SEASON_START + (i % amplitude)
            for i in range(n_centrales)
        ]


def calculate_thermique_production(
        power_mw: float,
        maintenance_week: int,
        date_start: datetime,
        date_end: datetime,
        name: str = "Centrale Thermique",
        fuel_type: str = "Gaz naturel",
        use_efficiency: bool = False
    ) -> pd.DataFrame:
    """
    Calcule la production annuelle d'une centrale thermique en MWh.

    Parameters
    ----------
    power_mw : float
        Puissance nominale de la centrale en MW. Doit être positif.
    maintenance_week : int
        Semaine de l'année où la production est nulle (1-52), assignée par assign_maintenance_weeks.
    date_start : datetime
        Date de début de la période de calcul.
    date_end : datetime
        Date de fin de la période de calcul. Doit 6etre postérieure à date_start.
    name : str, optional
        Nom de la centrale (par défaut "Centrale Thermique").
    fuel_type : str, optional
        Type de combustible : "charbon" ou "gaz" (par défaut "gaz").
    use_efficiency : bool, optional
        Si True, applique un coefficient d'efficacité (charbon/gaz). 
        Si False (défaut), utilise la puissance nominale directement.

    Returns
    -------
    pd.DataFrame
        Index horaire sur [date_start, date_end].
        Colonnes : 'production_mwh' (float), 'name' (str), 'fuel_type' (str).
    """
    # Définir l'efficacité selon le type de combustible
    efficiencies = {
        "Gaz naturel": 0.60,
        "Charbon": 0.40,
        "Diesel": 0.35,
        "Biomasse": 0.45,
    }
    efficiency = efficiencies.get(fuel_type, 0.60)  # défaut 60% si inconnu
 
    # Validation des entrées
    if power_mw <= 0:
        raise ValueError(f"power_mw doit être positif, reçu : {power_mw}")
    if not (1 <= maintenance_week <= 52):
        raise ValueError(f"maintenance_week doit être entre 1 et 52, reçu : {maintenance_week}")
    if date_start >= date_end:
        raise ValueError("date_start doit être antérieure à date_end")
    if fuel_type not in efficiencies:
        raise ValueError(f"fuel_type doit être 'Charbon' ou 'Gaz naturel' ou 'Diesel' ou 'Biomasse', reçu : {fuel_type!r}")
    
    # Créer un DataFrame avec une colonne pour chaque heure de l'année
    date_range = pd.date_range(
        start=date_start, end=date_end, freq="h"
    )

    hourly_production = power_mw * efficiency if use_efficiency else float(power_mw)
    production_df = pd.DataFrame({
        "production_mwh": hourly_production,
        "name": name,
        "fuel_type": fuel_type,
    }, index=date_range)

    # Appliquer la maintenance
    for year in range(date_start.year, date_end.year + 1):
        maintenance_start, maintenance_end = _get_maintenance_bounds(year, maintenance_week)
        production_df.loc[
            (production_df.index >= maintenance_start)
            & (production_df.index < maintenance_end), "production_mwh"
        ] = 0.0

    return production_df

if __name__ == "__main__":
    import matplotlib.pyplot as plt

    # Paramètres de la centrale thermique (Bécancour par défaut)
    power_mw = 411  # Puissance officielle en MW de Becancour
    maintenance_week = 22  # Semaine de maintenance (exemple)
    date_start = datetime(2025, 1, 1, 0, 0, 0)
    date_end = datetime(2027, 12, 31, 23, 59, 59)
    name = "Becancour"
    fuel_type = "Gaz naturel"

    # Calculer la production (sans coefficient d'efficacité pour refléter la puissance nominale brute)
    production_df = calculate_thermique_production(
        power_mw,
        maintenance_week,
        date_start,
        date_end,
        name=name,
        fuel_type=fuel_type,
        use_efficiency=False,
    )
    
    # Calculer la production hebdomadaire
    weekly_production = production_df.resample('W')['production_mwh'].sum()

    # Calculer la production annuelle totale en MWh
    annual_thermal_production = production_df['production_mwh'].sum()
    print(f"Production électrique thermique annuelle totale : {annual_thermal_production:.2f} MWh")

    # Tracer le graphique de la production hebdomadaire
    plt.figure(figsize=(10, 6))
    plt.step(weekly_production.index, weekly_production.values, where='post', color='b')
    plt.title('Production électrique thermique Hebdomadaire')
    plt.xlabel('Semaine de l\'année')
    plt.ylabel('Production (MWh)')
    plt.grid(True)
    weeks = [d.isocalendar()[1] for d in weekly_production.index[::4]]
    labels = [f"S{w}" for w in weeks]
    ticks = weekly_production.index[::4]
    plt.xticks(ticks=ticks, labels=labels, rotation=45)
    plt.show()