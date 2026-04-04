"""Orchestration du service `reseau_bis`.

Ce fichier conserve volontairement des noms :
- `charger_scenario`
- `creer_reseau`
- `calculer_production`

pour faciliter la migration depuis l'ancien `InfraReseau`.
"""

from datetime import timedelta
from typing import Any, Dict
import time
import pandas as pd
import pypsa

from .bus_connector import BusConnector
from .data_loader import NetworkDataLoaderBis, get_loader_todo_list
from .network_builder import build_pypsa_network, get_builder_todo_list
from .optimizer import run_dispatch_and_flow, get_optimizer_todo_list
from .results import extract_kpis, format_api_response, get_results_todo_list
from .utils.reservoir_tracker import compute_reservoir_levels, build_reservoir_feed_data


def get_reseau_bis_todo_list():
    """Aggrège les TODO de tous les sous-modules."""
    return (
        get_loader_todo_list()
        + get_builder_todo_list()
        + get_optimizer_todo_list()
        + get_results_todo_list()
    )


class InfraReseauBis:
    """Gabarit minimal inspire de la classe `InfraReseau`."""

    def __init__(self, liste_infra: Any):
        self.liste_infra = liste_infra
        self.scenario = None
        self.network: pypsa.Network | None = None
        self.timers: Dict[str, float] = {}
        self.data_loader = NetworkDataLoaderBis()

    def charger_scenario(self, scenario: Any) -> None:
        """Attache le scenario actif a l'instance de service."""
        self.scenario = scenario

    def _ensure_scenario(self) -> None:
        """Valide qu'un scenario est charge avant d'executer le workflow."""
        if self.scenario is None:
            raise ValueError("Le scenario n'est pas charge")

    def creer_reseau(self, db: Any, resolution: str = "hebdomadaire") -> pypsa.Network:
        """Construit le reseau PyPSA a partir de la topologie, generation et demande.

        resolution : "horaire" (8760 snapshots) ou "hebdomadaire" (52 moyennes hebdo, défaut).
        Le mode hebdomadaire réduit le LP-OPF à 1 seul appel solver au lieu de 37.
        """
        self._ensure_scenario()

        t0 = time.time()

        # Charger la topologie une seule fois et la passer aux loaders de profils
        # pour éviter le double chargement du xlsx.
        topology = self.data_loader.load_topology_from_db(db)
        topology = BusConnector(topology).connect_new_infras(self.liste_infra)
        buses_df = topology.get("buses", pd.DataFrame())

        gen_profiles = self.data_loader.load_generation_profiles(
            self.scenario, self.liste_infra, db,
            resolution=resolution,
            buses_df=buses_df,
        )
        demand_profile = self.data_loader.load_demand_profile(
            self.scenario, db,
            resolution=resolution,
            buses_df=buses_df,
        )

        self.timers["load_data"] = time.time() - t0

        # Dériver les snapshots depuis les profils rééchantillonnés (index réel)
        p_max_pu = gen_profiles.get("p_max_pu")
        if isinstance(p_max_pu, pd.DataFrame) and not p_max_pu.empty:
            snapshots = p_max_pu.index
        else:
            snapshots = pd.date_range(
                start=self.scenario.date_de_debut,
                end=self.scenario.date_de_fin,
                freq=self.scenario.pas_de_temps,
            )

        t1 = time.time()
        self.network = build_pypsa_network(
            topology=topology,
            generation_profiles=gen_profiles,
            demand_profile=demand_profile,
            snapshots=snapshots,
        )
        self.timers["build_network"] = time.time() - t1

        return self.network

    def calculer_production(
        self,
        db: Any,
        is_journalier: bool = False,
        flow_mode: str = "ac",
        resolution: str = "hebdomadaire",
    ) -> Dict[str, Any]:
        """Execute optimisation + flux puis retourne une reponse API prete.

        resolution : "horaire" ou "hebdomadaire" (défaut).
        is_journalier : conservé pour compatibilité API (non utilisé en interne).
        """
        self._ensure_scenario()

        total_start = time.time()

        if self.network is None:
            self.creer_reseau(db, resolution=resolution)

        # Pré-charger les métadonnées des barrages réservoirs pour le feed-forward OPF.
        # Doit être fait APRÈS creer_reseau() (snapshots connus) et AVANT l'optimiseur.
        t_feed = time.time()
        reservoir_feed = build_reservoir_feed_data(self.network, db)
        self.timers["reservoir_feed_build"] = time.time() - t_feed

        t_opt = time.time()
        optimizer_result = run_dispatch_and_flow(
            self.network,
            mode=flow_mode,
            reservoir_feed=reservoir_feed,
        )
        self.timers["dispatch_and_flow"] = time.time() - t_opt

        t_res = time.time()
        reservoir_levels = compute_reservoir_levels(self.network, db)
        self.timers["reservoir_tracker"] = time.time() - t_res

        t_kpi = time.time()
        kpis = extract_kpis(
            self.network,
            optimizer_result=optimizer_result,
            reservoir_levels=reservoir_levels,
        )
        self.timers["extract_kpis"] = time.time() - t_kpi

        total_time = time.time() - total_start
        self.timers["TOTAL"] = total_time

        return format_api_response(
            scenario_id=getattr(self.scenario, "id", -1),
            liste_infra_id=getattr(self.liste_infra, "id", -1),
            is_journalier=is_journalier,
            kpis=kpis,
            execution_time_seconds=total_time,
        )


    def _get_infras(self, infra_group: Any) -> Dict[str, list]:
        """Instancie les modules d'infrastructure a partir d'un infra_group."""
        from harmoniq.modules.eolienne import InfraParcEolienne
        from harmoniq.modules.solaire import InfraSolaire
        from harmoniq.modules.thermique import InfraThermique
        from harmoniq.modules.nucleaire import InfraNucleaire
        from harmoniq.modules.hydro import InfraHydro
        from harmoniq.db import schemas
        from harmoniq.db.CRUD import hydrate_model

        return {
            "hydro": [
                InfraHydro(hydrate_model(schemas.Hydro, item))
                for item in (infra_group.central_hydroelectriques or [])
            ],
            "nucleaire": [
                InfraNucleaire(hydrate_model(schemas.Nucleaire, item))
                for item in (infra_group.central_nucleaire or [])
            ],
            "thermique": [
                InfraThermique(hydrate_model(schemas.Thermique, item))
                for item in (infra_group.central_thermique or [])
            ],
            "eolienneparc": [
                InfraParcEolienne(hydrate_model(schemas.EolienneParc, item))
                for item in (infra_group.parc_eoliens or [])
            ],
            "solaire": [
                InfraSolaire(hydrate_model(schemas.Solaire, item))
                for item in (infra_group.parc_solaires or [])
            ],
        }

    def calculer_cout(self, infra_group: Any) -> Dict[str, list]:
        """Calcule les coûts de construction et annuels pour chaque infrastructure."""
        results = self._get_infras(infra_group)
        for key in results:
            results[key] = [
                {
                    "id": infra.donnees.id,
                    "cout_construction": infra.calculer_cout_construction(),
                    "cout_annuel": infra.calculer_cout_pas_de_temps(timedelta(days=365)),
                    **(
                        {"type_barrage": infra.donnees.type_barrage}
                        if hasattr(infra.donnees, "type_barrage")
                        else {}
                    ),
                }
                for infra in results[key]
            ]
        return results

    def calculer_co2(self, infra_group: Any) -> Dict[str, list]:
        """Calcule les émissions CO2 de construction et annuelles pour chaque infrastructure."""
        results = self._get_infras(infra_group)
        for key in results:
            results[key] = [
                {
                    "id": infra.donnees.id,
                    "co2_annuel": infra.calculer_co2_eq_pas_de_temps(timedelta(days=365)),
                    "co2_construction": infra.calculer_co2_eq_construction(),
                    **(
                        {"type_barrage": infra.donnees.type_barrage}
                        if hasattr(infra.donnees, "type_barrage")
                        else {}
                    ),
                }
                for infra in results[key]
            ]
        return results


def simulate_network(
    *,
    scenario: Any,
    liste_infra: Any,
    db: Any,
    is_journalier: bool = False,
    flow_mode: str = "ac",
    resolution: str = "hebdomadaire",
) -> Dict[str, Any]:
    """Facade fonctionnelle pour integration route/service."""
    infra_reseau = InfraReseauBis(liste_infra)
    infra_reseau.charger_scenario(scenario)
    return infra_reseau.calculer_production(
        db=db, is_journalier=is_journalier, flow_mode=flow_mode, resolution=resolution
    )
