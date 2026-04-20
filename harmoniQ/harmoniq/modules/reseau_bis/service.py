"""Orchestration du service ``reseau_bis``.

Expose ``InfraReseauBis`` et la façade fonctionnelle ``simulate_network``
pour l'intégration avec les routes REST.
"""

from datetime import timedelta
from typing import Any, Dict
import time
import pandas as pd
import pypsa

from .bus_connector import BusConnector
from .data_loader import NetworkDataLoaderBis, get_loader_todo_list
from .disaggregator import disaggregate_to_hourly
from .network_builder import build_pypsa_network, get_builder_todo_list
from .optimizer import run_dispatch_and_flow, get_optimizer_todo_list
from .results import extract_kpis, format_api_response, get_results_todo_list
from .utils.reservoir_tracker import compute_reservoir_levels, build_reservoir_feed_data


def get_reseau_bis_todo_list():
    """Agrège les listes de tâches de tous les sous-modules."""
    return (
        get_loader_todo_list()
        + get_builder_todo_list()
        + get_optimizer_todo_list()
        + get_results_todo_list()
    )


class InfraReseauBis:
    """Service de simulation réseau PyPSA pour un groupe d'infrastructures donné."""

    def __init__(self, liste_infra: Any):
        self.liste_infra = liste_infra
        self.scenario = None
        self.network: pypsa.Network | None = None
        self.timers: Dict[str, float] = {}
        self.data_loader = NetworkDataLoaderBis()

    def charger_scenario(self, scenario: Any) -> None:
        """Attache le scénario actif à l'instance.

        Args:
            scenario: Objet scénario (date_de_debut, date_de_fin, pas_de_temps, etc.).
        """
        self.scenario = scenario

    def _ensure_scenario(self) -> None:
        """Vérifie qu'un scénario est chargé avant d'exécuter le workflow.

        Raises:
            ValueError: Si aucun scénario n'a été attribué via ``charger_scenario``.
        """
        if self.scenario is None:
            raise ValueError("Le scenario n'est pas charge")

    def creer_reseau(self, db: Any, resolution: str = "hebdomadaire") -> pypsa.Network:
        """Construit le réseau PyPSA à partir de la topologie, de la génération et de la demande.

        Args:
            db: Session SQLAlchemy.
            resolution: ``"horaire"`` (8 760 snapshots) ou ``"hebdomadaire"`` (52 moyennes).
                Le mode hebdomadaire réduit significativement le temps de résolution du LP-OPF.

        Returns:
            Réseau PyPSA prêt pour l'optimisation.
        """
        self._ensure_scenario()

        t0 = time.time()

        # Charger la topologie une seule fois pour éviter un double aller-retour DB.
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

        # Dériver les snapshots depuis les profils rééchantillonnés.
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
        resolution: str = "horaire",
    ) -> Dict[str, Any]:
        """Exécute l'optimisation LP-OPF, le flux de puissance et retourne une réponse API.

        L'OPF tourne TOUJOURS sur 53 snapshots hebdomadaires (rapide).
        Si ``resolution="horaire"``, une désagrégation post-OPF projette le dispatch
        sur 8760 heures : les réservoirs absorbent les écarts ±MW intra-hebdomadaires.

        Args:
            db: Session SQLAlchemy.
            is_journalier: Conservé pour compatibilité API — non utilisé en interne.
            flow_mode: Mode d'écoulement de puissance (``"ac"`` ou ``"dc"``).
            resolution: ``"horaire"`` (défaut, 8760 lignes) ou ``"hebdomadaire"`` (52 lignes).

        Returns:
            Dict de réponse API formaté par ``format_api_response``.
        """
        self._ensure_scenario()

        total_start = time.time()

        # L'OPF tourne toujours en hebdomadaire, quelle que soit la résolution demandée.
        if self.network is None:
            self.creer_reseau(db, resolution="hebdomadaire")

        # Initialisation réservoirs à 95% (suggestion prof : headroom symétrique ± pour désagrégation)
        reservoir_gen_names = [
            g for g in self.network.generators.index
            if self.network.generators.loc[g, "carrier"] == "hydro_reservoir"
        ]
        initial_fills_95 = {g: 0.95 for g in reservoir_gen_names}

        # Pré-charger les données des barrages réservoirs (snapshots requis, avant l'optimiseur).
        t_feed = time.time()
        reservoir_feed = build_reservoir_feed_data(self.network, db, initial_levels=initial_fills_95)
        self.timers["reservoir_feed_build"] = time.time() - t_feed

        t_opt = time.time()
        optimizer_result = run_dispatch_and_flow(
            self.network,
            mode=flow_mode,
            reservoir_feed=reservoir_feed,
        )
        self.timers["dispatch_and_flow"] = time.time() - t_opt

        # Désagrégation horaire post-OPF
        if resolution == "horaire":
            t_disagg = time.time()
            hourly_demand = self.data_loader.load_demand_profile(
                self.scenario, db, resolution="horaire"
            )
            hourly_result = disaggregate_to_hourly(
                self.network, hourly_demand, reservoir_gen_names
            )
            dispatch_horaire = hourly_result["dispatch_horaire"]
            if not dispatch_horaire.empty:
                hourly_index = dispatch_horaire.index

                # Sauvegarder les time-series hebdo AVANT set_snapshots() qui les réindexe
                weekly_links_p0 = {}
                for attr in ("p0", "p1"):
                    ts = self.network.links_t.get(attr)
                    if ts is not None and not ts.empty:
                        weekly_links_p0[attr] = ts.copy()
                weekly_lines_p0 = {}
                for attr in ("p0", "p1"):
                    ts = self.network.lines_t.get(attr)
                    if ts is not None and not ts.empty:
                        weekly_lines_p0[attr] = ts.copy()

                # Remplacer snapshots + dispatch dans le network pour extract_kpis()
                self.network.set_snapshots(hourly_index)
                self.network.generators_t["p"] = dispatch_horaire

                # Étendre les flux de liens (import/export) à l'horaire par forward-fill hebdo.
                # L'import décidé par l'OPF reste constant sur toute la semaine —
                # seuls les réservoirs absorbent les écarts ±MW intra-hebdomadaires.
                for attr, weekly_ts in weekly_links_p0.items():
                    self.network.links_t[attr] = weekly_ts.reindex(
                        hourly_index, method="ffill"
                    ).fillna(0.0)
                for attr, weekly_ts in weekly_lines_p0.items():
                    self.network.lines_t[attr] = weekly_ts.reindex(
                        hourly_index, method="ffill"
                    ).fillna(0.0)

                # Aligner la demande horaire aussi (pour le bilan de puissance)
                # Note: hourly_demand est déjà uplifté (+7% T&D) par load_demand_profile,
                # ne pas réappliquer le facteur ici (double uplift bug corrigé).
                demand_hourly_aligned = hourly_demand.reindex(
                    hourly_index, method="nearest"
                )
                self.network.loads_t["p_set"] = demand_hourly_aligned
            self.timers["disaggregation"] = time.time() - t_disagg

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
        """Instancie les modules d'infrastructure à partir d'un groupe d'infras.

        Args:
            infra_group: Objet contenant les listes d'infrastructures par type.

        Returns:
            Dict ``{type: [instances]}`` avec les modules d'infrastructure hydratés.
        """
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
        """Calcule les coûts de construction et annuels pour chaque infrastructure.

        Args:
            infra_group: Objet contenant les listes d'infrastructures par type.

        Returns:
            Dict ``{type: [{"id", "cout_construction", "cout_annuel", ...}]}``.
        """
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
        """Calcule les émissions CO2 de construction et annuelles pour chaque infrastructure.

        Args:
            infra_group: Objet contenant les listes d'infrastructures par type.

        Returns:
            Dict ``{type: [{"id", "co2_annuel", "co2_construction", ...}]}``.
        """
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
    """Façade fonctionnelle pour l'intégration route/service.

    Args:
        scenario: Scénario de simulation.
        liste_infra: Groupe d'infrastructures.
        db: Session SQLAlchemy.
        is_journalier: Conservé pour compatibilité API.
        flow_mode: Mode d'écoulement de puissance (``"ac"`` ou ``"dc"``).
        resolution: Résolution temporelle (``"horaire"`` ou ``"hebdomadaire"``).

    Returns:
        Dict de réponse API formaté par ``format_api_response``.
    """
    infra_reseau = InfraReseauBis(liste_infra)
    infra_reseau.charger_scenario(scenario)
    return infra_reseau.calculer_production(
        db=db, is_journalier=is_journalier, flow_mode=flow_mode, resolution=resolution
    )
