from harmoniq.core.base import Infrastructure
from harmoniq.core.meteo import WeatherHelper, Granularity, EnergyType
from harmoniq.db.schemas import ScenarioBase, PositionBase
from harmoniq.modules.eolienne.calcule import get_parc_power
from harmoniq.modules.eolienne.turbine_data import turbine_models

import pandas as pd
import numpy as np
import numpy as np
import logging
from pathlib import Path

logger = logging.getLogger("EolienneParc")

# ------------------------------------------------------------------
# Configuration rapide de la source meteo eolienne.
# - "era5": utilise le cache ERA5 prepare localement
# - "openmeteo": utilise la source historique Open-Meteo
# ------------------------------------------------------------------
WEATHER_SOURCE_FOR_EOLIEN = "era5"  # Change this line to "openmeteo" if needed.
WEATHER_TIMEZONE_OUT = "UTC"  # Mainly used for the ERA5 branch.


class InfraParcEolienne(Infrastructure):
    def _charger_meteo(self, scenario: ScenarioBase):
        # Bloc de preparation meteo:
        # on recupere la position du parc, la granularite du scenario,
        # puis on delegue le chargement a WeatherHelper.
        lat = self.donnees.latitude
        long = self.donnees.longitude
        logger.info(f"Latitude: {lat}, Longitude: {long}")
        pos = PositionBase(latitude=lat, longitude=long)
        granularite = (
            Granularity.HOURLY if scenario.pas_de_temps.days == 0 else Granularity.DAILY
        )
        logger.info(f"Granularité de Meteo: {granularite}")
        logger.info(f"Source meteo eolien selectionnee: {WEATHER_SOURCE_FOR_EOLIEN}")

        wind_energy = EnergyType.EOLIEN
        if WEATHER_SOURCE_FOR_EOLIEN not in {"openmeteo", "era5"}:
            raise ValueError(
                f"Invalid WEATHER_SOURCE_FOR_EOLIEN={WEATHER_SOURCE_FOR_EOLIEN}. "
                "Expected 'openmeteo' or 'era5'."
            )

        # Bloc de branchement meteo:
        # WeatherHelper encapsule toute la logique de source (ERA5/Open-Meteo),
        # de normalisation et d'alignement temporel.
        helper = WeatherHelper(
            position=pos,
            start_time=scenario.date_de_debut,
            end_time=scenario.date_de_fin,
            interpolate=True,
            granularity=granularite,
            data_type=wind_energy,
            # --- COMMENT CHANGER LA BASE DE DONNEE DES VENTS ---
            # Pour switche entre OPEN-METEO et ERA5 :
            # WEATHER_SOURCE_FOR_EOLIEN = "openmeteo" at top of this file.
            weather_source=WEATHER_SOURCE_FOR_EOLIEN,
            timezone_out=WEATHER_TIMEZONE_OUT,
        )


        return helper.load()

    def charger_scenario(self, scenario):
        super().charger_scenario(scenario)
        self.meteo: pd.DataFrame = self._charger_meteo(scenario)

    def calculer_production(self) -> pd.DataFrame:
        # Bloc de calcul principal pour un parc:
        # conversion meteo -> puissance horaire via get_parc_power.
        nom = self.donnees.nom
        logger.info(f"Calcul de la production pour {nom}")
        return get_parc_power(self.donnees, self.meteo)

    def calculer_cout_construction(self) -> np.ndarray:
        COST_PER_MW = 2_600_000  # $/MW
        return self.donnees.capacite_total * COST_PER_MW

    def calculer_cout_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        OPEX_PER_MW_PER_YEAR = 60_000  # $/MW/year
        HOURS_PER_YEAR = 8760

        annual_cost = self.donnees.capacite_total * OPEX_PER_MW_PER_YEAR
        hours = pas_de_temps.total_seconds() / 3600
        return annual_cost * (hours / HOURS_PER_YEAR)


    def calculer_co2_eq_construction(self) -> np.ndarray:
        # Really rought estimate, need to be improved
        CO2_PER_MW = 100
        return self.donnees.capacite_total * CO2_PER_MW

    def calculer_co2_eq_pas_de_temps(self, pas_de_temps=None) -> np.ndarray:
        # Really rought estimate, need to be improved
        if pas_de_temps is None:
            pas_de_temps = self.scenario.pas_de_temps

        co2_intensity = 11 / 1000

        CAPACITY_FACTOR = 0.35
        HOURS_PER_YEAR = 8760
        annual_energy = self.donnees.capacite_total * HOURS_PER_YEAR * CAPACITY_FACTOR
        annual_co2 = annual_energy * co2_intensity
        hours = pas_de_temps.total_seconds() / 3600
        return annual_co2 * (hours / HOURS_PER_YEAR)


if __name__ == "__main__":
    # Bloc "runner local":
    # execute un calcul complet sur tous les parcs de la DB
    # pour le premier scenario disponible.
    from harmoniq.db.CRUD import read_all_scenario, read_all_eolienne_parc
    import asyncio
    from harmoniq.db.engine import get_db
    from harmoniq.modules.eolienne.weibull.Weibull_calcule import (
        compute_weibull_expected_power,
        extract_annual_coefficients_from_details,
        extract_seasonal_coefficients_from_details,
        month_to_season,
        mean_operational_loss_factor,
        parse_weibull_fit_details,
    )

    # Bloc d'initialisation des objets de travail:
    # - connexion DB
    # - buffer d'agregation globale
    # - chargement liste parcs + scenarios
    db = next(get_db())
    production_totale = pd.DataFrame()
    timestamps_ref = None
    stats_parc = []
    eoliennes = read_all_eolienne_parc(db)
    scenarios = read_all_scenario(db)

    if not scenarios:
        raise ValueError("Aucun scenario disponible en base de donnees")

    scenario = scenarios[0]

    # Bloc de boucle par parc:
    # pour chaque parc on charge meteo + production, puis on accumule
    # des stats horaires et des indicateurs de comparaison Weibull.
    for eolienne_parc in eoliennes:
        parc_id = eolienne_parc.id
        print(f"Traitement du parc éolien avec l'ID: {parc_id}")
        infraEolienne = InfraParcEolienne(eolienne_parc)

        asyncio.run(infraEolienne.charger_scenario(scenario))

        production_iteration = infraEolienne.calculer_production()
        if timestamps_ref is None:
            timestamps_ref = pd.to_datetime(production_iteration["tempsdate"])

        # Keep per-park indicators so they can be exported to a file.
        power_parc_kw = production_iteration["puissance"].astype(float).fillna(0.0)
        weibull_k = getattr(eolienne_parc, "weibull_k", None)
        weibull_c = getattr(eolienne_parc, "weibull_c", None)
        weibull_mean_kw = float("nan")
        weibull_expected_kw = float("nan")
        weibull_loss_factor = float("nan")
        weibull_error = None

        details = parse_weibull_fit_details(getattr(eolienne_parc, "weibull_fit_details", None))
        annual_from_details = extract_annual_coefficients_from_details(details)
        seasonal_from_details = extract_seasonal_coefficients_from_details(details)
        if annual_from_details is not None:
            weibull_k, weibull_c = annual_from_details

        if weibull_k is not None and weibull_c is not None:
            try:
                turbine_data = turbine_models.get(eolienne_parc.modele_turbine, None)
                if turbine_data is None:
                    raise ValueError(f"Unknown turbine model: {eolienne_parc.modele_turbine}")
                weibull_expected_kw = compute_weibull_expected_power(
                    eolienne_parc,
                    turbine_data,
                    weibull_k=float(weibull_k),
                    weibull_c=float(weibull_c),
                )
                weibull_loss_factor = mean_operational_loss_factor(infraEolienne.meteo)
                weibull_mean_kw = weibull_expected_kw * weibull_loss_factor

                # If seasonal coefficients are available, compute a seasonal alpha profile
                # and override the annual scalar approximation.
                if seasonal_from_details:
                    timestamps = pd.to_datetime(production_iteration["tempsdate"])
                    hourly_kw = power_parc_kw.to_numpy(dtype=float)
                    hourly_mean_kw = float(np.mean(hourly_kw))
                    annual_alpha = (
                        float(weibull_mean_kw) / hourly_mean_kw
                        if np.isfinite(hourly_mean_kw) and hourly_mean_kw > 0
                        else 1.0
                    )
                    alpha_vec = np.full(len(hourly_kw), annual_alpha, dtype=float)
                    months = timestamps.dt.month.astype(int).to_numpy()
                    for season_name, (s_k, s_c) in seasonal_from_details.items():
                        season_mask = np.array(
                            [month_to_season(int(m)) == season_name for m in months],
                            dtype=bool,
                        )
                        if not np.any(season_mask):
                            continue
                        season_hourly_mean = float(np.mean(hourly_kw[season_mask]))
                        if not np.isfinite(season_hourly_mean) or season_hourly_mean <= 0:
                            continue
                        season_expected_kw = compute_weibull_expected_power(
                            eolienne_parc,
                            turbine_data,
                            weibull_k=float(s_k),
                            weibull_c=float(s_c),
                        )
                        season_meteo = infraEolienne.meteo.loc[
                            infraEolienne.meteo.index.month.isin(
                                {12, 1, 2}
                                if season_name == "winter"
                                else {3, 4, 5}
                                if season_name == "spring"
                                else {6, 7, 8}
                                if season_name == "summer"
                                else {9, 10, 11}
                            )
                        ]
                        season_loss = (
                            mean_operational_loss_factor(season_meteo)
                            if not season_meteo.empty
                            else weibull_loss_factor
                        )
                        season_weibull_mean = season_expected_kw * season_loss
                        alpha_vec[season_mask] = season_weibull_mean / season_hourly_mean
                    weibull_mean_kw = float(np.mean(hourly_kw * alpha_vec))
            except Exception as exc:
                weibull_error = str(exc)

        stats_parc.append(
            {
                "parc_id": parc_id,
                "parc_nom": eolienne_parc.nom,
                "weibull_k": weibull_k,
                "weibull_c": weibull_c,
                "puissance_moyenne_horaire_kw": power_parc_kw.mean(),
                "puissance_moyenne_horaire_mw": power_parc_kw.mean() / 1000.0,
                "puissance_moyenne_weibull_theorique_kw": weibull_expected_kw,
                "puissance_moyenne_weibull_theorique_mw": weibull_expected_kw / 1000.0
                if pd.notna(weibull_expected_kw)
                else float("nan"),
                "weibull_loss_factor": weibull_loss_factor,
                "puissance_moyenne_weibull_kw": weibull_mean_kw,
                "puissance_moyenne_weibull_mw": weibull_mean_kw / 1000.0
                if pd.notna(weibull_mean_kw)
                else float("nan"),
                "puissance_max_kw": power_parc_kw.max(),
                "puissance_max_mw": power_parc_kw.max() / 1000.0,
                "weibull_error": weibull_error,
            }
        )

        if production_totale.empty:
            production_totale = production_iteration.copy()
        else:
            production_totale["puissance"] += production_iteration["puissance"]

    if production_totale.empty:
        raise ValueError("Aucune production calculee")

    # Bloc de post-traitement global:
    # calcule les KPI systeme (puissance moyenne, pointe, energie, facteur de charge)
    # a partir de la somme des parcs.
    # "puissance" is instant power in kW at each timestamp.
    power_kw = production_totale["puissance"].astype(float).fillna(0.0)
    timestamps = (
        timestamps_ref
        if timestamps_ref is not None
        else pd.to_datetime(production_totale["tempsdate"])
    )

    # Infer simulation time step from data (default to 1h if unavailable).
    pas_de_temps_h = 1.0
    if len(timestamps) > 1:
        deltas_h = timestamps.diff().dt.total_seconds().div(3600.0)
        deltas_h = deltas_h[deltas_h > 0]
        if not deltas_h.empty:
            pas_de_temps_h = float(deltas_h.median())

    duree_h = len(power_kw) * pas_de_temps_h
    puissance_installee_mw = (
        sum(float(p.puissance_nominal) * float(p.nombre_eoliennes) for p in eoliennes)
        / 1000.0
    )

    # Energy over the simulated period: sum(P[kW] * dt[h]) -> kWh, then MWh.
    energie_mwh = (power_kw.sum() * pas_de_temps_h) / 1000.0
    energie_gwh = energie_mwh / 1000.0

    # Instant power indicators.
    puissance_moyenne_mw = power_kw.mean() / 1000.0
    puissance_max_mw = power_kw.max() / 1000.0
    facteur_de_charge = (
        puissance_moyenne_mw / puissance_installee_mw
        if puissance_installee_mw > 0
        else float("nan")
    )

    print("----- Resume production eolienne -----")
    print(f"Scenario: {scenario.nom}")
    print(f"Parcs traites: {len(eoliennes)}")
    print(f"Pas de temps estime: {pas_de_temps_h:.2f} h")
    print(f"Duree simulee: {duree_h:.1f} h")
    print(f"Puissance installee totale: {puissance_installee_mw:.2f} MW")
    print(f"Puissance moyenne simulee: {puissance_moyenne_mw:.2f} MW")
    print(f"Puissance de pointe simulee: {puissance_max_mw:.2f} MW")
    print(f"Energie totale sur la periode: {energie_mwh:.2f} MWh ({energie_gwh:.2f} GWh)")
    print(f"Facteur de charge implicite: {facteur_de_charge:.2%}")

    # Bloc d'analyse parc par parc:
    # consolide les stats et mesure l'ecart entre simulation horaire et estimateur Weibull.
    stats_df = pd.DataFrame(stats_parc)
    stats_df["energie_horaire_mwh"] = (
        stats_df["puissance_moyenne_horaire_mw"].astype(float) * duree_h
    )
    stats_df["energie_weibull_mwh"] = (
        stats_df["puissance_moyenne_weibull_mw"].astype(float) * duree_h
    )
    stats_df["biais_moyenne_mw"] = (
        stats_df["puissance_moyenne_weibull_mw"].astype(float)
        - stats_df["puissance_moyenne_horaire_mw"].astype(float)
    )
    stats_df["ecart_moyenne_mw"] = stats_df["biais_moyenne_mw"].abs()
    denom = stats_df["puissance_moyenne_horaire_mw"].astype(float)
    denom = denom.where(denom != 0, float("nan"))
    stats_df["ecart_moyenne_pct"] = (stats_df["ecart_moyenne_mw"] / denom) * 100.0

    valid_weibull = stats_df["puissance_moyenne_weibull_mw"].notna()
    if valid_weibull.any():
        mean_abs_delta_mw = stats_df.loc[valid_weibull, "ecart_moyenne_mw"].mean()
        mean_abs_delta_pct = stats_df.loc[valid_weibull, "ecart_moyenne_pct"].mean()
        print("----- Comparaison horaire vs Weibull -----")
        print(f"Parcs avec coefficients Weibull: {int(valid_weibull.sum())}/{len(stats_df)}")
        print(f"Ecart moyen absolu: {mean_abs_delta_mw:.2f} MW ({mean_abs_delta_pct:.2f}%)")

        top_over = stats_df.loc[valid_weibull].sort_values("biais_moyenne_mw", ascending=False).head(3)
        top_under = stats_df.loc[valid_weibull].sort_values("biais_moyenne_mw", ascending=True).head(3)
        if not top_over.empty:
            print("Top sur-estimations Weibull (MW):")
            for _, row in top_over.iterrows():
                print(f"  {row['parc_nom']}: {row['biais_moyenne_mw']:.2f}")
        if not top_under.empty:
            print("Top sous-estimations Weibull (MW):")
            for _, row in top_under.iterrows():
                print(f"  {row['parc_nom']}: {row['biais_moyenne_mw']:.2f}")

    # Bloc de sortie:
    # export CSV final des indicateurs de performance par parc.
    stats_df = stats_df.sort_values("ecart_moyenne_pct", ascending=False, na_position="last")
    output_path = Path(__file__).with_name("puissance_moyenne_parc_eolien.csv")
    stats_df.to_csv(output_path, index=False, encoding="utf-8")
    print(f"Fichier exporte: {output_path}")
